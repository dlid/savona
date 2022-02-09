import { CameraIrisControl } from './camera/controls/iris/camera-iris-control';
import { ConnectionDetails } from './protocol/index';
import { Protocol, CameraEvent } from './protocol/protocol';
import { BehaviorSubject, Observable } from 'rxjs';
import { LogBase } from './log/log-base.class';

export enum CameraConnectionStatus {
    Disconnected,
    Connecting,
    Connected
}

/**
 * Create a new Camera object that can connect to your Sony PXW-Z190V camera
 */
export class Camera extends LogBase {

    private device: ConnectionDetails;
    private protocol: Protocol;
    private irisControl: CameraIrisControl;
    private isCameraConnected = false;
    private connectionSubject = new BehaviorSubject<CameraConnectionStatus>(CameraConnectionStatus.Disconnected);

    public get host(): string {
        return this.device.host;
    }

    public get description(): string {
        return this.descriptionText;
    }

    public get isConnected(): boolean {
        return this.isCameraConnected;
    }

    /**
     * An observable that contains the connection status of the camera
     * This is a BehaviorSubject so you will get the current status when 
     */
    public get connectionStatus(): Observable<CameraConnectionStatus> {
        return this.connectionSubject.asObservable();
    } 
     

    constructor(hostname: string, private username: string, private password: string, private descriptionText: string) {
        super(`camera ${hostname}`)
        this.device = {
            username: username,
            password: password,
            host: hostname
        };  
        this.protocol = new Protocol(this.device);
        this.irisControl = new CameraIrisControl(this, this.protocol);

        // Make sure children log bases will forward protocol logs to its listeners
        this.protocol.log.subscribe(e => this.forwardLog(e));
        this.irisControl.log.subscribe(e => this.forwardLog(e));

        this.protocol.on(CameraEvent.Connected, () => {
            this.isCameraConnected = true;
            this.connectionSubject.next(CameraConnectionStatus.Connected);
        });

        this.protocol.on(CameraEvent.Disconnected, () => {
            this.isCameraConnected = false;
            this.connectionSubject.next(CameraConnectionStatus.Disconnected);
        });

    }

    public get Iris(): CameraIrisControl {
        return this.irisControl;
    }

    /**
     * Make sure a connection exists and that it's authenticated
     */
    public async connect(): Promise<boolean> {
        
        if (this.isConnected) {
            return true;
        }

        this.connectionSubject.next(CameraConnectionStatus.Connecting);

        try {
            this.isCameraConnected = await this.protocol.connect();
            this.info(`Connection established`);
            
            return this.isConnected;
        } catch (e) {
            this.debug(`Could not connect to camera`);
            this.isCameraConnected = false;
            return Promise.reject(e);
        }
    }


    public async disconnect(): Promise<void> {
        this.debug(`Disconnecting camera`);
        if (this.isConnected) {
            this.protocol.disconnect();
        }

        this.debug(`Waiting for camera to disconnect`);
        return new Promise(resolve => {
            this.connectionStatus.subscribe(c => {
                if (c === CameraConnectionStatus.Disconnected) {
                    this.debug(`Camera was disconnected`);
                    resolve();
                }
            })
        });

       
    }

    public async method(name: string, parameters?: any): Promise<any> {
        return await this.protocol.request(name, parameters);
    }

    public onAudioLevelChange() {
        
    }

    public async test(): Promise<void> {

        if (await this.connect()) {
            
        } else {
            console.log("nej");
        }

    }


}
