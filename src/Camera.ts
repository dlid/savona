import { CameraIrisControl } from './camera/controls/iris/camera-iris-control';
import { ConnectionDetails } from './protocol/index';
import { Protocol, CameraEvent } from './protocol/protocol';
import { rejects } from 'assert';

export class Camera {

    private device: ConnectionDetails;
    private protocol: Protocol;
    private irisControl: CameraIrisControl;
    private isConnected = false;

    public get host(): string {
        return this.device.host;
    }

    public get description(): string {
        return this.descriptionText;
    }

    constructor(hostname: string, private username: string, private password: string, private descriptionText: string) {
        this.device = {
            username: username,
            password: password,
            host: hostname
        };  
        this.protocol = new Protocol(this.device);
        this.irisControl = new CameraIrisControl(this, this.protocol);

        this.protocol.on(CameraEvent.Connected, () => {
            this.isConnected = true;
        });

        this.protocol.on(CameraEvent.Disconnected, () => {
            this.isConnected = false;
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
            console.log("we are connected?");
            return true;
        }

        try {
            this.isConnected = await this.protocol.connect();
            console.log("ON", this.isConnected);
            this.protocol.on(CameraEvent.Connected, async () => {
                console.log("CONNETED EVENT INSIDE CAMERA!");

//                await this.Iris.GetIrisValues();
            });
            return this.isConnected;
        } catch (e) {
            console.log("fel fel fel 2");
            this.isConnected = false;
            return Promise.reject(e);
        }
    }


    public async disconnect(): Promise<void> {
        if (this.isConnected) {
            this.protocol.disconnect();
        }
        return Promise.resolve();
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
