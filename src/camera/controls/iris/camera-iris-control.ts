import { Protocol, CameraEvent } from '../../../protocol/protocol';
import { Camera } from '../../../camera';
import { CameraIrisValue } from '.';
import { LogBase } from '../../../log/log-base.class';

export class CameraIrisControl extends LogBase {

    private irisValues: number[] = [];
    private changeHandlers: { [key: string]: (value: CameraIrisValue) => void } = {};

    constructor(private camera: Camera, private protocol: Protocol) {
        super(`camera.iris ${camera.host}`);
        this.subscribeToIrisChanges();
    }

    private subscribeToIrisChanges() {
        this.protocol.onNotification('Notify.Property.Value.Changed', async p => {
            const irisValues = await this.GetIrisValues();

            if (p['Camera.Iris.FValue'] && p['Camera.Iris.Value']) {
                const isClosed = p['Camera.Iris.Value'] === irisValues[irisValues.length - 1];
                let val: CameraIrisValue = {
                    FValue: p['Camera.Iris.FValue'],
                    Value: p['Camera.Iris.Value'],
                    isClosed
                };
                Object.keys(this.changeHandlers).forEach(key => {
                    this.changeHandlers[key](val);
                });
            }
        });
    }

    private createId(): string {
        let id = 0;
        do {
            id = 4294967295 <= id ? 0 : id + 1;
        } while (this.changeHandlers[id]);
        return id.toString();        
    }

    /**
     * Register a callback function for when camera push out an iris value change 
     * @param callback 
     */
    public addChangeHandler(callback: (value: CameraIrisValue) => void): string {
        const id = this.createId();
        this.changeHandlers[id] = callback;
        return id;
    }

    /**
     * Remove a registerd callback function
     * @param callback 
     */
    public removeChangeHandler(id: number): void {
        delete this.changeHandlers[id];
    }

    /**
     * Get the list of valid iris values from the camera itself
     */
    public async GetIrisValues(): Promise<number[]> {

        if (this.irisValues) {
            return Promise.resolve(this.irisValues);
        }

        let result = await this.camera.method('Capability.GetValue', ['Camera.Iris.Value']);

        if (!result) {
            console.log('Could not get iris values. Trying again...');
            result = await this.camera.method('Capability.GetValue', ['Camera.Iris.Value']);
        }

        if (result['Camera.Iris.Value']) {
            const values = result['Camera.Iris.Value'] as number[];
            this.irisValues = ((values[2] as unknown) as number[])
        }

        return this.irisValues || [];
    }

    /**
     * Set the Iris value for the camera
     * @param value The numeric value 
     * @param retreiveUpdatedValue Set to true to get the new property value from the camera and return it
     */
    public async SetValue(value: number, retreiveUpdatedValue: boolean = true): Promise<number | void> {
        await this.camera.method('Property.SetValue', 
        { 
            "Camera.Iris.Value": value,
            "Camera.Iris.Close.Enabled": false
        });

        if (retreiveUpdatedValue) {
            return await this.GetValue();
        }
    }

    public async GetValue(): Promise<number> {
        
        const result = await this.camera.method('Property.GetValue', {"Camera.Iris.Value": '*'});

        if (result['Camera.Iris.Value']) {
            return result['Camera.Iris.Value'];
        }

        return -1;

    }

    public async SetAuto(): Promise<void> {
        
        await this.camera.method('Property.SetValue', { 
            "Camera.Iris.SettingMethod": 'Automatic'
        });
    }

    public async SetManual(): Promise<void> {
        await this.camera.method('Property.SetValue', { 
            "Camera.Iris.SettingMethod": 'Manual'
        });
    }

}
