import { ApplicationError, AuthenticationError } from '../errors/AuthenticationError';
import { ConnectionDetails, CameraRequest } from './protocol.types';
import * as axios from 'axios'
import WebSocket from 'ws';
import { LogBase } from '../log/log-base.class';
const msgpack = require('msgpack');



export enum CameraEvent {
    Disconnected,
    Connected,
    IrisValue
}


export class Protocol extends LogBase {

    private savonaCredentials?: ConnectionDetails;
    private ws?: WebSocket;
    private requests: { [id: string]: CameraRequest } = {};
    private savonaUser?: string;
    private savonaPassword?: string;
    private eventListeners: { [key: number]: ((p: any) => void)[] } = {};
    private notificationListeners: { [key: string]: ((p: any) => void)[] } = {};
    private isConnecting = false;
    private isConnected = false;

    private connectingPromise?: Promise<boolean> = undefined;

    constructor(private connectionDetails: ConnectionDetails) {
        super(`camera.protocol ${connectionDetails.host}`)
    }


    public on(event: CameraEvent, callback: (p: any) => void) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    public onNotification(name: string, callback: (p: any) => void) {
        if (!this.notificationListeners[name]) {
            this.notificationListeners[name] = [];
        }
        this.notificationListeners[name].push(callback);
    }

    private invokeEvent(event: CameraEvent, param?: any) {
        this.eventListeners[event]?.forEach(e => {
            e(param);
        })
    }

    private invokeonNotificationEvent(name: string, param?: any) {
        this.notificationListeners[name]?.forEach(e => {
            e(param);
        })
    }

    private createRequestId(): number {
        let id = 0;
        do {
            id = 4294967295 <= id ? 0 : id + 1;
        } while (this.requests[id]);
        return id;        
    }

    private async reconnect() {
        console.log("attempting to reconnect...");
       
        let connected = false;
        do {
            connected = await this.connect();
            console.log("Connected:", connected);
        } while(!connected);

    }

    public async disconnect(): Promise<void> {
        this.debug(`Disconnecting Protocol Websocket connection`);
        this.ws?.close(42);
        // TODO: Actually wait for it to disconnect....
        return Promise.resolve();
    }

    /**
     * Establish a connection if none already exists
     */
    public async connect(): Promise<boolean> {
        const self = this;
        if (!this.isConnected && this.isConnecting && this.connectingPromise) {
            return this.connectingPromise;
        }
        if (this.isConnected) {
            return Promise.resolve(true);
        }
        this.isConnecting = true;
        
        this.connectingPromise = new Promise<boolean>(async (resolve, reject) => {
            this.debug(`Fetching credentials for ${this.connectionDetails.host}`);
            try {
                await this.getSavonaCredentials();
            } catch (e) {
                this.isConnected = false;
                this.isConnecting = false;
                reject(e);
                return;
            }

            const connectionString = `ws://${this.connectionDetails.host}/linear`;
            this.debug(`Connecting to ${connectionString}`);
            this.ws = new WebSocket(connectionString);

            this.ws.on('open', async () => {
                
                this.debug(`WebSocket Connection was opened to camera ${this.connectionDetails.host}`);

                if (this.ws?.readyState === 1 && this.savonaUser && this.savonaPassword) {
                    try {
                        this.isConnected = true;
                        this.isConnecting = false;

                        const svaret = await this.AlternateAuthenticationBasic(this.savonaUser, this.savonaPassword);

                        this.debug(`Fetching properties`);
                        await this.request('Notify.Subscribe', ["Notify.Properties", "Notify.Process", "Notify.Property"]);

                        this.invokeEvent(CameraEvent.Connected);
                        resolve(true);
                    }catch (e) {
                        this.error(`Error connecting to WebSocket`, e);
                    }
                }
            });
            
            this.ws.on('error', (e: any) => {
                this.error(`Error connecting to ${this.connectionDetails.host}`, e);
                this.isConnected = false;
                this.isConnecting = false;
            });

            this.ws.on('close', (code: number) => {
                this.debug(`WebSocket Connection was closed to camera ${this.connectionDetails.host} (Code ${code})`);
                
                this.isConnected = false;
                this.isConnecting = false;
                this.invokeEvent(CameraEvent.Disconnected);
                this.ws = undefined;
                setTimeout(async () => await this.reconnect());
            });
    
            this.ws.on('message', function incoming(data: any) {
                
                if (data) {
                    const unpacked = msgpack.unpack(data);
                    if (unpacked) {
                        const [type, id, data1, data2] = unpacked;


                        if (type === 1) {
                            if (self.requests[id]) {
                                const req = self.requests[id];
                                delete self.requests[id];
                               // console.log(unpacked);
                                req.callback.resolve(data2);
                            }
                        } else if (type === 2) { // Notification

                          //  if ()

                            if (id === 'Notify.Property.Value.Changed') {

                                self.invokeonNotificationEvent(id, data1[0]);

                                if (data1[0]['Output.Audio.Level']) {
                                   // console.log("audio...", JSON.stringify(data1));
                              //  } else if (data[0]['Camera.Iris.FValue'])
                                } else if (data[0]['P.Clip.Mediabox.TimeCode.Value']) {

                                } else {
//                                   console.log("[NOTIFICATION]", id, data1);
                                }
                            }
                        } else {
                            console.log("Unknown data from camera", unpacked);
                        }
                    }
                }
            });

        });

        return this.connectingPromise;
        
 
        // ws.on('open', () => {
        //     console.log("Connection open");

        //     // var id = client.alternate.authentication.Basic({
        //     //     params: {username: cred[0], password: cred[1]},

        //     let d = {
        //         method: 'Alternate.Authentication.Basic',
        //         params: {username: cred[0], password: cred[1]}
        //     };

        //     console.log(d);


        //     // let d = {
        //     //         method: 'System.GetProperties',
        //     //         params: ["Notify.Properties", "Notify.Process", "Notify.Property"]
        //     //     };
        //     const id = 144;
        //    // const da: Uint8Array = encode( [0, id, d.method, d.params]);

        //     const da = msgpack.pack([0, id, d.method, [d.params]]);

        //     console.log(da);

        //     // const 
    
        //     ws.send(da);
    }

    private async AlternateAuthenticationBasic(username: string, password: string): Promise<void> {
        return this.request('Alternate.Authentication.Basic', { username: username, password: password });
    }

    public async request<T>(method: string, params?: any): Promise<T> {

        
        // console.log(`[protocol:request] ${method}`, params);
        

        const req: CameraRequest = {
            method: method,
            params: params ? params : null,
            id: this.createRequestId(),
            timeoutMs: 2000,
            callback: { reject: () => {}, resolve: (o: any) => {} }
        };

        const data = [0, req.id, req.method, req.params !== null ? [req.params] : null];
        // if (data[data.length - 1] === null) {
        //     data.pop();
        // }
        const da = msgpack.pack(data);

       // console.log("send", JSON.stringify(data));

       await this.connect();

       if (!this.isConnected) {
           return Promise.reject();
       }

        this.requests[req.id] = req;
        
        const promise = new Promise<T>((resolve, reject) => {
            req.callback.resolve = resolve;
            req.callback.reject = reject;
            if (this.ws) {
                this.ws.send(da);
                // setTimeout(() => {
                //     if (this.requests[req.id]) {
                //         reject(`${req.method} timed out after ${req.timeoutMs} ms`);
                //     }
                // }, req.timeoutMs);
            } else {
                reject(`ws object was undefined`);
            }
        });

        return promise;
    }

 

    private async getSavonaCredentials(): Promise<ConnectionDetails> {

        if (this.savonaCredentials) {
            return this.savonaCredentials;
        }

        try {
            // I think this response is simply basic auth using base64 - but it's a good way to validate credentials and camera connection anyway
            const response = await axios.default({
                method: 'get',
                url: `http://${this.connectionDetails.username}:${this.connectionDetails.password}@${this.connectionDetails.host}/cgi-bin/getsavonacred.cgi`,
                timeout: 5000
            })
            const cred = (response.data as string).split(':');
            this.savonaUser = cred[0];
            this.savonaPassword = cred[1];

            this.savonaCredentials = {
                host: this.connectionDetails.host,
                username: this.savonaUser,
                password: this.savonaPassword            
            };


        } catch (e: any) {
            if ( 'isAxiosError' in e) {
                return Promise.reject(new AuthenticationError("Could not verify credentials", `Camera responded with code ${e.response?.status || 'undefined'}`));
            } else {
                return Promise.reject(new AuthenticationError("Could not verify credentials", e));
            }
        }
        
        return this.savonaCredentials;
    }

} 
