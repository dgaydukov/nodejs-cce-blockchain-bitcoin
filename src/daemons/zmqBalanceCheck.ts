

import {default as config} from "@root/config.json"

const zmq = require('zmq')
const sub = zmq.socket('sub')

export class ZmqBalanceCheck{
    listen(){
        sub.connect(`tcp://127.0.0.1:${config.BITCOIN_ZERO_MQ_PORT}`)
        /**
         * subscribe to all topics. For specific topics set names like sub.subscribe('tx')
         */
        sub.subscribe('')

        sub.on('message', (topic, message)=>{
            console.log('zmq', topic, message)
        });
    }
}