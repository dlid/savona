import { AnyNaptrRecord } from "dns";

export interface ConnectionDetails {
    host: string;
    username: string;
    password: string;

}

export interface CameraRequest {
    method: string; 
    params: any;
    id: number;
    timeoutMs: number;
    callback: {
        resolve: (result: any) => void;
        reject: () => void;
    };
}

export interface CameraResponse {

}