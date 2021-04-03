export enum AlarmTopic {
    RAW = 'raw',
    MODE = 'mode',
    KEY_PRESS = 'key/press',
}

export enum JablotronRecordType {
    STATUS = 'e0',
}

/**
 Value	Value (binary)	Mode
 0x00	0000 0000	service mode
 0x20	0010 0000	user mode
 0x40	0100 0000	disarmed
 0x41	0100 0001	armed
 0x44	0100 0100	tamper/silent alarm
 0x45	0100 0101	alarm triggrd
 0x49	0100 1001	entry delay
 0x51	0101 0001	arming
 0x61	0110 0001	zone A armed
 0x63	0110 0011	zone B armed
 0x69	0110 1001	entry delay B
 0x71	0111 0001	zone A arming
 0x73	0111 0011	zone B arming
 */
export enum JblMode {
    // noinspection JSUnusedGlobalSymbols
    SERVICE = '00',
    USER = '20',
    DISARMED = '40',
    ARMED = '41',
    TAMPERED = '44',
    SILENT_ALARM = '44',
    TRIGGERED = '45',
    ENTRY_DELAY = '49',
    ARMING = '51',
    ZONE_A_ARMED = '61',
    ZONE_B_ARMED = '63',
    // Extra
    ENTRY_DELAY_B = '69',
    ARMING_A = '71',
    ARMING_B = '73',
}

export enum Command {
    CLEAR = 'N',
    ARM = 'F1',
}

export const MANUFACTURER = 'Jablotron';
