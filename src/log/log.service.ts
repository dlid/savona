import "reflect-metadata";

export class LogService {

    private colors: { [key: string]: string } = {
        'reset': '\x1b[0m',
        'black': "\x1b[30m",
        'red': "\x1b[31m",
        'green': "\x1b[32m",
        'yellow': "\x1b[33m",
        'blue': "\x1b[34m",
        'magenta': "\x1b[35m",
        'cyan': "\x1b[36m",
        'white': "\x1b[37m"
    }

    public debug(text: string): void {
        console.log( this.bepaint("{color:yellow}LOG:"), text);
    }
    

    bepaint(value: string, stripAnsi = false): string {
        let match: RegExpMatchArray | null;
        let newValue: string = value;
        let coloredTexts: string[] = [];
        do {
            match = newValue.match(/\{color:([a-zA-Z\-]+)\}(.*?)(\{color\}|$)/);
            if (match) {
                newValue = newValue.replace(match[0], `_%C${coloredTexts.length}%_`);
                
                if (this.colors[match[1]]) {
                    coloredTexts.push( ( stripAnsi ? '' : this.colors[match[1]]) + match[2] + ( stripAnsi ? '' : this.colors['reset']) );
                } else {
                    coloredTexts.push(match[2]);
                }
            }
        } while(match);

        coloredTexts.forEach((text: string, i: number) => {
            newValue = newValue.replace(`_%C${i}%_`,  text);
        })

        return newValue;
    }

}


// Singleton class we have added below.
export class Logger {
    // Use the `Logger` type
    private static instance: LogService
    // Use a private constructor
    private constructor() {}
    // Ensure that there is only one instance created
    public static getInstance(): LogService {
        if (!Logger.instance) {
            Logger.instance = new LogService()
        }        
        return Logger.instance
    }
}