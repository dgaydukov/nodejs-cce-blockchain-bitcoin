/**
 * Straight way balance check with constant longpolling of bitcoin node (bitcoind) with all addresses that
 * we have in our database. The deamon simply run across every address in db and check if it balance has changed,
 * that means somebody (but not we) made transaction and move money to daemon.
 */
require('module-alias/register')
const debug = require("debug")("mptheck")
import {KafkaConnector} from "@kafka/kafkaConnector"
import {Address} from "@db/models/address"
import {MempoolTx} from "@db/models/mempoolTx"
import {Transaction} from "@db/models/transaction"
import {BitcoinNode} from "@blockchain/bitcoinNode"
import {buildMessage} from "@daemons/helpers"
import {METHOD_NEW_MEMPOOL_TX} from "@root/constList"

const MAX_CONFIRMATION_NUMBER = process.env.MAX_CONFIRMATION_NUMBER

const run = () => {
    const intervalTime = Number(process.env.RUN_INTERVAL) * 1000
    const node = new BitcoinNode()
    const kc = new KafkaConnector()
    let allowRun = true
    const inner = ()=>{
        if(allowRun) {
            debug("start")
            allowRun = false
            check(node, kc)
                .then(() => {
                    allowRun = true
                    debug(`-------------finish-------------`)
                })
                .catch((ex) => {
                    allowRun = true
                    debug(`Error: ${ex}`)
                })
        }
    }
    inner();
    setInterval(inner, intervalTime)
}

const check = async(node, kc)=>{
    /**
     *  For test purpose you can clear latestblock & transaction
     *  LatestBlock.collection.drop()
     */
    try{
        const dbAddressList = await Address.find({})
        const dbMempollTxList = await MempoolTx.find({})
        debug(`number of address to watch: ${dbAddressList.length}`)
        debug(`db mempool tx number: ${dbMempollTxList.length}`)
        const addressList = {}
        const txList = {}
        dbAddressList.map(item=> {
            if (item.address) {
                addressList[item.address.toLowerCase()] = item
            }
        })
        dbMempollTxList.map(txItem=>{
            txList[txItem.txId] = 1
        })
        const mempoolTxList = await node.getMempoolTxList()
        const watchList = []
        mempoolTxList.map(txId=> {
            if(!txList[txId]){
                watchList.push(txId)
            }
        })
        const len = watchList.length
        debug(`number of tx to check ${len}`)
        for(let i = 0; i < len; i++){
            const txId = watchList[i]
            const tx = await node.getTxById(txId)
            const newMpTx = new MempoolTx({
                txId: txId
            })
            newMpTx.save()
            tx.vout.map(output=>{
                const addresses = output.scriptPubKey.addresses;
                if(addresses){
                    const outputAddress = addresses[0].toLowerCase()
                    const outputAddressItem = addressList[outputAddress]
                    if(outputAddressItem){
                        const amount = parseFloat(output.value)
                        debug(`address found: ${outputAddress}, ${amount}`)
                        const newTx = new Transaction({
                            txId: txId,
                            addressTo: outputAddressItem.address,
                            amount: output.value,
                        })
                        newTx.save()
                        kc.send(buildMessage(METHOD_NEW_MEMPOOL_TX, {
                                address: outputAddressItem.address,
                                amount: amount,
                                txId: txId,
                            })
                        );
                    }
                }
            })
        }
    }
    catch(ex){
        debug(`Error: ${ex}`)
    }
}


run()