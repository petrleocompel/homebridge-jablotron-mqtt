
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">
<img src="https://www.jablotron.com/static/img/logo-jablotron.svg" width="150">

</p>


# homebridge-jablotron-mqtt

Homebridge plugin for Jablotron 6x alarms using mqtt queue and [py-jablotron6x](https://github.com/pezinek/py-jablotron6x) and JA-80T serial cable.

## Example config

```json
{
    "bridge": {},
    "description": "Jablotron security system connector",
    "accessories": [
        {
            "accessory": "JablotronMqttSecurity",
            "name": "Jablotron",
            "subtype": "Doma",
            "model": "JA-60 Comfort",
            "mqttUrl": "mqtt://192.168.0.250",
            "mqttTopicPrefix": "alarm",
            "securityCode": "0000",
            "allowCommunication": true
        }
    ]
}
```

## Mapping

> Actual mappings

```
STAY_ARM -> Armed
AWAY_ARM -> Armed
NIGHT_ARM -> Armed
DISARM -> Disarmed
```