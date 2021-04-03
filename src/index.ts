import {API} from 'homebridge';

import {PLUGIN_NAME, ACCESSORY_NAME} from './settings';
import {JbMqttAccPlg} from './accessory';

export = (api: API) => {
    api.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, JbMqttAccPlg);
};
