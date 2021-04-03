import {
    AccessoryPlugin,
    AccessoryConfig,
    API,
    Logging,
    Service,
    Characteristic,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
} from 'homebridge';
import * as mqtt from 'mqtt';
import {JblMode, AlarmTopic, JablotronRecordType, Command, MANUFACTURER} from './const';
import {ACCESSORY_NAME} from './settings';

enum JbMqttCustomConfigKeys {
    SECURITY_CODE = 'securityCode',
    MQTT_USERNAME = 'username',
    MQTT_PASSWORD = 'password',
    MQTT_URL = 'mqttUrl',
    MQTT_TOPIC_PREFIX = 'mqttTopicPrefix',
    MQTT_START_CMD = 'startCmd',
    MQTT_START_PARAM = 'startParameter',
    MODEL = 'MODEL',
}

export class JbMqttAccPlg implements AccessoryPlugin {
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;

    private securityCode: string;

    private name: string;
    private model: string;

    private currentState = 3; //Characteristic.SecuritySystemCurrentState.DISARMED;
    private client_Id: string = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    private mqttOptions: mqtt.IClientOptions = {};
    private mqttUrl: string;
    private mqttTopics: string[] | string;
    private mqttTopicPrefix: string;
    private client: mqtt.MqttClient;
    private allowCommunication = false;

    private runningChangeCallback?: CharacteristicSetCallback = undefined;
    private runningChangeTarget?: JblMode = undefined;

    private log: Logging;

    private securityStateService: Service;
    private informationService: Service;

    constructor(logger: Logging, config: AccessoryConfig, api: API) {
        this.log = logger;
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;
        this.name = config.name;
        this.model = config[JbMqttCustomConfigKeys.MODEL];
        this.securityCode = config[JbMqttCustomConfigKeys.SECURITY_CODE];
        this.mqttOptions = {
            keepalive: 10,
            clientId: this.client_Id,
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            will: {
                topic: 'WillMsg',
                payload: 'Connection Closed abnormally..!',
                qos: 0,
                retain: false,
            },
            username: config[JbMqttCustomConfigKeys.MQTT_USERNAME],
            password: config[JbMqttCustomConfigKeys.MQTT_PASSWORD],
            rejectUnauthorized: false,
        };
        this.mqttUrl = config[JbMqttCustomConfigKeys.MQTT_URL];
        this.mqttTopicPrefix = config[JbMqttCustomConfigKeys.MQTT_TOPIC_PREFIX] || '';
        this.mqttTopics = [this.getTopic(AlarmTopic.RAW), this.getTopic(AlarmTopic.MODE)];
        this.client = mqtt.connect(this.mqttUrl, this.mqttOptions);

        this.log('Subsribing to', this.mqttTopics);
        this.client.subscribe(this.mqttTopics);

        const securityStateService = new api.hap.Service.SecuritySystem(ACCESSORY_NAME, 'MODEL TODO');

        securityStateService
            .getCharacteristic(api.hap.Characteristic.SecuritySystemCurrentState)
            .on(api.hap.CharacteristicEventTypes.GET, this.getCurrentState.bind(this));

        securityStateService
            .getCharacteristic(api.hap.Characteristic.SecuritySystemTargetState)
            .on(api.hap.CharacteristicEventTypes.GET, this.getTargetState.bind(this))
            .on(api.hap.CharacteristicEventTypes.SET, this.setTargetState.bind(this));

        this.securityStateService = securityStateService;

        const informationService = new api.hap.Service.AccessoryInformation();

        informationService
            .setCharacteristic(api.hap.Characteristic.Name, this.name)
            .setCharacteristic(api.hap.Characteristic.Manufacturer, MANUFACTURER)
            .setCharacteristic(api.hap.Characteristic.Model, this.model)
            .setCharacteristic(api.hap.Characteristic.SerialNumber, '-');

        this.informationService = informationService;

        this.client.on('error', () => {
            this.log('Error event on MQTT');
        });

        this.client.on('connect', () => {
            if (config['startCmd'] !== undefined && config['startParameter'] !== undefined) {
                this.client.publish(config[JbMqttCustomConfigKeys.MQTT_START_CMD], config[JbMqttCustomConfigKeys.MQTT_START_PARAM]);
            }
        });
        this.client.on('message', (topic: AlarmTopic, message: Buffer) => {
            const text = message.toString();
            if (topic === this.getTopic(AlarmTopic.RAW)) {
                //Raw

                /// e0 41 11 59 29 03 3d ff
                /*
                00	1 byte	e0/e1/e2 - general status
                01	1 byte	mode
                02	1 byte	binary status of leds ???
                03	1 byte	content of display ???
                04	1 byte	strength of GSM signal/battery??
                05	1 byte	zero one or two
                06	1 byte	checksum
                07	1 byte	0xFF - indicates end of message
                */
                const arrE0 = text.split(' ');
                if (arrE0.length === 8) {
                    if (arrE0[0] === JablotronRecordType.STATUS) {
                        let newState: number | undefined = undefined;
                        let stateName;
                        const jblMode = arrE0[1];
                        switch (jblMode as JblMode) {
                            case JblMode.ARMED:
                                newState = this.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
                                stateName = 'AWAY_ARM';
                                break;
                            case JblMode.DISARMED:
                                newState = this.Characteristic.SecuritySystemCurrentState.DISARMED;
                                stateName = 'DISARMED';
                                break;
                            case JblMode.TAMPERED:
                            case JblMode.TRIGGERED:
                                newState = this.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
                                stateName = 'ALARM_TRIGGERED';
                                break;
                            default:
                                stateName = 'UNKNOWN';
                            //change = false;
                        }

                        if (newState !== undefined) {
                            if (this.runningChangeCallback !== undefined && jblMode === this.runningChangeTarget) {
                                try {
                                    this.runningChangeCallback(null, newState);
                                } catch (e) {
                                    this.log('Error sending event back to callback from raw', e);
                                    this.runningChangeCallback = undefined;
                                }
                            }
                            if (newState !== this.currentState) {
                                this.log('setting new state', stateName);
                                this.currentState = newState;
                                this.securityStateService
                                    .getCharacteristic(api.hap.Characteristic.SecuritySystemCurrentState)
                                    .setValue(this.currentState, 'fromSetValue');
                            }
                        }
                    }
                }
            }
        });
    }

    async asyncPublish(topic: AlarmTopic, message: string, opts: mqtt.IClientPublishOptions = {}): Promise<mqtt.Packet | undefined> {
        return new Promise<mqtt.Packet | undefined>((resolve, reject) => {
            this.client.publish(this.getTopic(topic), message, opts, (error, packet) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(packet);
                }
            });
        });
    }

    getTopic(name: AlarmTopic): string {
        return this.mqttTopicPrefix + '/' + name;
    }

    getServices(): Service[] {
        return [this.securityStateService, this.informationService];
    }

    changeState = async (target: JblMode): Promise<void> => {
        await this.asyncPublish(AlarmTopic.KEY_PRESS, Command.CLEAR);
        if (target === JblMode.ARMED) {
            await this.asyncPublish(AlarmTopic.KEY_PRESS, Command.ARM);
        } else if (target === JblMode.DISARMED) {
            await this.asyncPublish(AlarmTopic.KEY_PRESS, this.securityCode);
        }
    };

    getCurrentState(callback: CharacteristicGetCallback): void {
        callback(null, this.currentState);
    }

    getTargetState(callback: CharacteristicGetCallback): void {
        callback(null, this.currentState);
    }

    setTargetState(state: CharacteristicValue, callback: CharacteristicSetCallback): void {
        this.log('Getting current state');

        if (this.runningChangeCallback !== undefined) {
            this.runningChangeTarget = undefined;
            this.runningChangeCallback(new Error('Cancelled'));
            this.runningChangeCallback = undefined;
        }

        if (this.currentState === state) {
            callback(null, state);
            return;
        }

        let targetState: JblMode | undefined = undefined;
        switch (state) {
            case this.Characteristic.SecuritySystemTargetState.STAY_ARM:
            case this.Characteristic.SecuritySystemTargetState.AWAY_ARM:
            case this.Characteristic.SecuritySystemTargetState.NIGHT_ARM:
                targetState = JblMode.ARMED;
                break;
            case this.Characteristic.SecuritySystemTargetState.DISARM:
                targetState = JblMode.DISARMED;
                break;
        }

        if (!this.allowCommunication) {
            this.log('Communication is forbiden', 'current state:', this.currentState, 'new state:', targetState);
            callback(new Error('Communication is forbiden'));
            return;
        }
        if (!this.client.connected) {
            this.log('MQTT is not connected');
            callback(new Error('MQTT is not connected'));
            return;
        }

        if (targetState !== undefined) {
            this.runningChangeTarget = targetState;
            this.runningChangeCallback = callback;

            this.changeState(targetState).catch(e => {
                this.runningChangeTarget = undefined;
                this.runningChangeCallback = undefined;
                callback(e, null);
                this.log('Error in invoke', e);
            });
        }
    }
}
