import { Logger } from './log.service';
import { Observable, Subject } from "rxjs";

export interface SavonaLogEntry {
    level: 'debug' | 'info' | 'error' | 'warning';
    date: Date;
    origin?: string;
    message: string;
    data?: any;
}

export abstract class LogBase {

    private logSubject = new Subject<SavonaLogEntry>();
    private logOrigin?: string;

    constructor(originName: string) {
        this.logOrigin = originName;
    }

    public get log(): Observable<SavonaLogEntry> {
        return this.logSubject.asObservable();
    }

    public forwardLog(e: SavonaLogEntry): void {
        this.logSubject.next(e);
    }

    public info(message: string, data: any = null): void {
        this.logSubject.next({
            date: new Date(),
            level: 'info',
            message: message,
            origin: this.logOrigin,
            data: data
        });
    }

    public error(message: string, data: any = null): void {
        this.logSubject.next({
            date: new Date(),
            level: 'error',
            message: message,
            origin: this.logOrigin,
            data: data
        });
    }

    public warn(message: string, data: any = null): void {
        this.logSubject.next({
            date: new Date(),
            level: 'warning',
            message: message,
            origin: this.logOrigin,
            data: data
        });
    }

    public debug(message: string, data: any = null): void {
        this.logSubject.next({
            date: new Date(),
            level: 'debug',
            message: message,
            origin: this.logOrigin,
            data: data
        });
    }

}
