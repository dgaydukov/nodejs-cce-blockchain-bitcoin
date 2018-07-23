/**
 * Straight way balance check with constant longpolling of bitcoin node (bitcoind) with all addresses that
 * we have in our database. The deamon simply run across every address in db and check if it balance has changed,
 * that means somebody (but not we) made transaction and move money to daemon.
 */
require('module-alias/register')

const debug = require("debug")("bcheck")
import {KafkaConnector} from "@kafka/kafkaConnector"
import {Address} from "@db/models/address"
import {Transaction, TYPE} from "@db/models/transaction"
import {LatestBlock} from "@db/models/latestBlock"
import {BitcoinNode} from "@blockchain/bitcoinNode"
import {default as config} from "@root/config.json"
import {buildMessage} from "@deamons/helpers"

const RUN_TIME = 10
const WAIT_TIME = 10
const METHOD_NEW_BALANCE = "newBalance"
const METHOD_NEW_TRANSACTION = "newTx"
const node = new BitcoinNode()
const kc = new KafkaConnector()

let allowRun = true



setInterval(()=>{
    if(allowRun){
        allowRun = false
        const finishCb = (n) => {
            allowRun = true
            debug(`----------finish block #${n}----------`)
        }
        check(finishCb)
    }
}, RUN_TIME * 1000)


const check = (finishCb) => {
    /**
     *  For test purpose you can clear latestblock & transaction
     *  LatestBlock.collection.drop()
     *  Transaction.collection.drop()
     */
    const finish = (lastBlockNumber, lastBlock = null) => {
        if(lastBlock){
            lastBlock.save()
        }
        setTimeout(()=>{
            finishCb(lastBlockNumber)
        }, WAIT_TIME * 1000)
    }
    Address.find({}, (err, data)=>{
        //get last checked block
        LatestBlock.findOne({}, (err, lastBlock)=>{
            let lastBlockNumber;
            if(!lastBlock){
                lastBlock = new LatestBlock()
                lastBlockNumber = config.BITCOIN_SYNC_START_BLOCK
            }
            else{
                lastBlockNumber = lastBlock.blockNumber
            }
            lastBlockNumber = Number(lastBlockNumber)
            lastBlock.blockNumber = lastBlockNumber + 1
            debug(`----------start block #${lastBlockNumber}----------`)

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

            node.getBlockByNumber(lastBlockNumber, (err, block)=>{
                if(err){
                    debug(`error: ${err.message}`)
                    finish(lastBlockNumber)
                    return
                }
                const len = block.tx.length
                debug(`number of tx: ${len}`)
                if(len == 0){
                    finish(lastBlockNumber, lastBlock)
                }
                block.tx.map((txId, i)=>{
                    //execute transaction request every 100 ms
                    setTimeout(()=>{
                        node.getTransaction(txId, (err, tx)=>{
                            if(i == len - 1){
                                finish(lastBlockNumber, lastBlock)
                            }
                            if(err || null == tx){
                                return;
                            }
                            tx.vout.map(output=>{
                                const addresses = output.scriptPubKey.addresses;
                                if(addresses){
                                    const outputAddress = addresses[0].toLowerCase()
                                    const amount = parseFloat(output.value)
                                    const outputAddressItem = addressList[outputAddress]
                                    if(outputAddressItem){
                                        debug(`address found: ${outputAddress}, ${amount}`)
                                        Transaction.findOne({txId: txId}, (err, dbTx)=>{
                                            //if transaction doesn't exist create and recalculate balance
                                            if(!dbTx){
                                                dbTx = new Transaction()
                                                dbTx.txId = txId
                                            }
                                            dbTx.addressFrom = []
                                            dbTx.addressTo = outputAddressItem.address
                                            dbTx.amount = amount
                                            dbTx.confirmationNumber = tx.confirmations
                                            dbTx.blockNumber = lastBlockNumber
                                            dbTx.type = TYPE.INPUT
                                            dbTx.save((err, data)=>{
                                                debug(`tx saved ${txId}, address: ${outputAddress}`)
                                                kc.send(buildMessage(METHOD_NEW_BALANCE, {
                                                        address: outputAddressItem.address,
                                                        amount: amount,
                                                        txId: data.txId,
                                                    })
                                                );
                                                //update address table for total address balance
                                                Transaction.find({addressTo: outputAddress}, (err, data)=>{
                                                    let balance = 0
                                                    data.map(item=>{
                                                        balance += Number(item.amount)
                                                    })
                                                    outputAddressItem.balance = balance.toFixed(8)
                                                    outputAddressItem.save((err, data)=>{
                                                    })
                                                })
                                            })
                                        })
                                    }
                                }
                            })
                            /**
                             * pure bitcoin feature, we need to go one level deep to to get address from
                             */
                            const vinLen = tx.vin.length
                            const vinCb = (txId, list) => {
                                Transaction.findOne({txId: txId, addressFrom: []}, (err, txItem)=>{
                                    if(txItem){
                                        txItem.addressFrom = list
                                        txItem.save((err, savedTx)=>{
                                            debug(`tx updated`, savedTx)
                                            kc.send(buildMessage(METHOD_NEW_TRANSACTION, {
                                                    txId: txId,
                                                    addressFrom: savedTx.addressFrom,
                                                    addressTo: savedTx.addressTo,
                                                    amount: savedTx.amount,
                                                    confirmationNumber: savedTx.confirmationNumber,
                                                    blockNumber: savedTx.blockNumber,
                                                })
                                            );
                                        })
                                    }
                                })
                            }
                            const vinAddressList = []
                            tx.vin.map((input, i)=>{
                                if(input.txid){
                                    node.getTransaction(input.txid, (err, inTx)=>{
                                        if(err){
                                            return
                                        }
                                        const inputAddressItem = inTx.vout[tx.vin[i].vout]
                                        const addresses = inputAddressItem.scriptPubKey.addresses;
                                        if(addresses){
                                            vinAddressList.push(addresses[0])
                                        }
                                        if(i == vinLen - 1){
                                            vinCb(txId, vinAddressList)
                                        }
                                    })
                                }
                            })
                        })
                    }, i * 100)
                })
            })
        })
    })
}