import { Protocol, CameraEvent } from '../../../protocol/protocol';
import { Camera } from '../../../camera';
import { CameraIrisValue } from '.';
import { LogBase } from '../../../log/log-base.class';

export class CameraIrisControl extends LogBase {

    private irisValues: number[] = [];
    private changeHandlers: { [key: string]: (value: CameraIrisValue) => void } = {};
    private settingChangeHandlers: { [key: string]: (setting: 'Automatic' | 'Manual') => void } = {};

    constructor(private camera: Camera, private protocol: Protocol) {
        super(`camera.iris ${camera.host}`);
        this.subscribeToIrisChanges();
    }

    private subscribeToIrisChanges() {
        this.protocol.onNotification('Notify.Property.Value.Changed', async p => {
            const irisValues = await this.GetIrisValues();
            // console.log("CHANGE", p);

            if (p && p['Camera.Iris.FValue'] && p['Camera.Iris.Value']) {
                const isClosed = p['Camera.Iris.Value'] === irisValues[irisValues.length - 1];
                let val: CameraIrisValue = {
                    FValue: p['Camera.Iris.FValue'],
                    Value: p['Camera.Iris.Value'],
                    isClosed
                };
                Object.keys(this.changeHandlers).forEach(key => {
                    this.changeHandlers[key](val);
                });
            } else if (p && p['Camera.Iris.SettingMethod']) {
                Object.keys(this.settingChangeHandlers).forEach(key => {
                    const value = p['Camera.Iris.SettingMethod'] == 'Automatic' ? 'Automatic' : 'Manual';
                    this.settingChangeHandlers[key](value);
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

    public onSettingMethodChanged(callback: (setting: 'Automatic' | 'Manual') => void): string {
        const id = this.createId();
        this.settingChangeHandlers[id] = callback;
        return id;
    }

    /**
     * Remove a registerd callback function
     * @param callback 
     */
    public removeChangeHandler(id: number): void {
        delete this.changeHandlers[id];
    }

    public removeSettingChangeHandler(id: string): void {
        delete this.settingChangeHandlers[id];
    }

    /**
     * Get the list of valid iris values from the camera itself
     */
    public async GetIrisValues(): Promise<number[]> {

        if (this.irisValues?.length > 0) {
            return Promise.resolve(this.irisValues);
        }

        let result = await this.camera.method('Capability.GetValue', ['Camera.Iris.Value']);

        if (!result) {
            console.log('Could not get iris values. Trying again...');
            result = await this.camera.method('Capability.GetValue', ['Camera.Iris.Value']);
        }

        if (result && result['Camera.Iris.Value']) {
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
            // return await this.GetValue();
        }
    }

    public async GetPercentFromValue(number: number): Promise<number | undefined> {

        const allIrisValues = (await this.GetIrisValues());
        let allowedIrisValues = allIrisValues.slice(0, allIrisValues.length - 1);

        allowedIrisValues = allowedIrisValues.reverse();
        
        const xx = 100 / (allowedIrisValues.length );

        for (let i = 0; i < allowedIrisValues.length; i++) {

            const val = allowedIrisValues[i];
            const from = i === 0 ? 0 : i * xx;
            const to = xx * (i+1);

            if (number === val) {
//                if (from > 80) {
                    return to;
  //              }
    //            return from;
            }
        }

        return undefined;
    }

    public async GetValueFromPercent(percentage: number): Promise<number | undefined> {
        const allIrisValues = (await this.GetIrisValues());
        let allowedIrisValues = allIrisValues.slice(0, allIrisValues.length - 1);
        allowedIrisValues = allowedIrisValues.reverse();
        const xx = 100 / (allowedIrisValues.length );
        percentage = percentage * 100;
        for (let i = 0; i < allowedIrisValues.length; i++) {

            const val = allowedIrisValues[i];
            const from = i === 0 ? 0 : i * xx;
            const to = xx * (i+1);
            if (percentage >= from && percentage <= to) {
                return val;
            }
        }
    }


    /**
     * Based on the list of available iris values, this will let you 
     * set the irus value by percent instead of the actual value
     * @param percentage Percentage (0-1)
     */
    public async SetValueByPercent(percentage: number, retreiveUpdatedValue: boolean = true): Promise<number | void> {
        const allIrisValues = (await this.GetIrisValues());
        const allowedIrisValues = allIrisValues.slice(0, allIrisValues.length - 1);
        const xx = 100 / (allowedIrisValues.length );
        percentage = percentage * 100;

        // Find percentage value for the controller value
        for (let i = 0; i < allowedIrisValues.length; i++) {

            const val = allowedIrisValues[i];
            const from = i === 0 ? 0 : i * xx;
            const to = xx * (i+1);

            if (percentage >= from && percentage <= to) {
              //  console.log("SET VALUE", val);
                return await this.SetValue(val, retreiveUpdatedValue);
            }
        }
    
    }

    
    public async GetValue(): Promise<number> {
        
        const result = await this.camera.method('Property.GetValue', {"Camera.Iris.Value": '*'});

        if (result && result['Camera.Iris.Value']) {
            return result['Camera.Iris.Value'];
        }

        return -1;

    }

    public async GetSetting(): Promise<'Automatic' | 'Manual' | undefined> {
        const result = await this.camera.method('Property.GetValue', {"Camera.Iris.SettingMethod": '*'});

        if (result && result['Camera.Iris.SettingMethod']) {
            return result['Camera.Iris.SettingMethod'];
        }

        return undefined;

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
