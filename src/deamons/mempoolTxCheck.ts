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
import {buildMessage} from "@deamons/helpers"

const RUN_TIME = 10
const WAIT_TIME = 10
const METHOD_NEW_MEMPOOL_TX = "newMempoolTx"

const node = new BitcoinNode()
const kc = new KafkaConnector()
let allowRun = true


setInterval(()=>{
    if(allowRun){
        debug("start")
        allowRun = false
        const finishCb = () => {
            allowRun = true
            debug("-------------finish-------------")
        }
        check(finishCb)
    }
}, RUN_TIME * 1000)



const check = (finishCb) => {
    /**
     *  For test purpose you can clear latestblock & transaction
     *  LatestBlock.collection.drop()
     */

     Address.find({}, (err, data)=>{
         const addressList = {}
         debug(`number of address to watch: ${data.length}`)
         if(data){
             data.map(addressItem=>{
                 const address = addressItem.address
                 if(address){
                     addressList[address.toLowerCase()] = addressItem
                 }
             })
         }
         MempoolTx.find({}, (err, data)=>{
             if(err){
                 debug(err.toString())
                 return finishCb()
             }
             const txList = {}
             debug(`db tx number: ${data.length}`)
             if(data){
                 data.map(txItem=>{
                     txList[txItem.txId] = 1
                 })
             }
             node.getMempoolTxList((err, list)=>{
                 if(err || null == list){
                     debug(err.toString())
                     return finishCb()
                 }
                 const watchList = []
                 list.map(txId=>{
                     if(!txList[txId]){
                         watchList.push(txId)
                     }
                 })
                 const len = watchList.length
                 debug(`number of tx to check: ${len}`)
                 watchList.map((txId, i)=>{
                     setTimeout(()=>{
                         node.getTransaction(txId, (err, tx)=>{
                             if(i == len - 1){
                                 finishCb()
                             }
                             if(err || null == tx){
                                 return;
                             }
                             const newMpTx = new MempoolTx({
                                 txId: txId
                             })
                             newMpTx.save((err, data)=>{
                                 if(err){
                                     return debug(err)
                                 }
                             })
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
                                         newTx.save((err, dta)=>{

                                         })
                                         kc.send(buildMessage(METHOD_NEW_MEMPOOL_TX, {
                                                 address: outputAddressItem.address,
                                                 amount: amount,
                                                 txId: txId,
                                             })
                                         );
                                     }
                                 }
                             })
                         })
                     }, i * 100)
                 })
             })
         })
    })
}