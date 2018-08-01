# Node.js CCE (Crypto Currency Exchange) BlockChain Bitcoin 

## Content
* [Project Description](#project-description)
* [Project Structure](#project-structure)
* [Built With](#built-with)
* [Installation](#installation)
* [Auto Testing](#auto-testing)
* [Kafka](#kafka)
* [Bitcoind TestNet](#bitcoind-testnet)
* [Module loading](#module-loading)
* [Authors](#authors)

### Project Description
Bitcoin Proxy is a project to connect bitcoin node (bitcoind) and CCE. Communication works through Kafka. Communication with bitcoin node works
throught json RPC.

### Project Structure
```
dist - javascript folder with compiled typescript from src folder
src - source code folder (typescript)
-logic - project bisyness logic
-deamons - deamons that constantly run
--balanceCheck.ts
--mempoolTxCheck.ts
--txConfirmationCheck.ts
--zmqBalanceCheck.ts
-kafka - kafkaconnector logic
-db - database folder (interfaces & models)
```

### Built With

* [Kafka](https://kafka.apache.org/quickstart) - how to install & run kafkCoa
* [KafkaJs](https://www.npmjs.com/package/kafka-node) - node.js module for kafka
* [MongoDb](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu) - how to install & run mongo
* [Mongoose](https://www.npmjs.com/package/mongoose) - node.js module for mongoDb
* [ZeroMQ](http://zeromq.org) - how to install & run zeroMq
* [Node.js ZeroMQ](https://www.npmjs.com/package/zmq) - node.js module for zeromq
* [BitcoinCore](https://www.npmjs.com/package/bitcoin-core) - node.js module for bitcoind
* [Bitcoin API](https://en.bitcoin.it/wiki/Original_Bitcoin_client/API_calls_list) - bitcoin node (bitcoind) API

### Installation

```shell
#run mongod
sudo service mongod start

#run zookeepr & kafka
sudo service zookeeper start
cd kafka && bin/kafka-server-start.sh config/server.properties


#clone & run project
git clone https://github.com/dgaydukov/nodejs-cce-blockchain-bitcoin.git
cd nodejs-cce-blockchain-bitcoin
npm i
npm start
# $pid - process id in pm2
npm start $pid --timestamp

#create kafka topics
bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic bitcoinProxyRequest
bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic bitcoinProxyResponse


# run deamons
npm run bcheck
npm run txcheck
npm run mptcheck
```


### Auto Testing

You can run auto tests with `npm test`
For testing purpose we use the following arhitecture
testing framework + assertion module + test doubles + code coverage
* [Mocha](https://mochajs.org) - testing framework
* [Chai](http://www.chaijs.com) - assertion module
* [Sinon](http://sinonjs.org) - test doubles
* [Mocha](https://github.com/gotwarlost/istanbul) - code coverage



### Kafka

For communication with kafka we have a special format that consist of 3 parts, data, metadata, error (if exists)
```json
{
  "data": {

  },
  "metadata": {
    "guid": "",
    "methodName": "",
    "timestamp": ""
  },
  "error": {
    "message": ""
  }
}
```

To check out kafka connection you can use command line. For this purpose you should go to kafka folder and execute following commands:

```shell
# 1. Create topics to run
bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic bitcoinProxyRequest
bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic bitcoinProxyResponse


# 2. Listen kafka messages
bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic bitcoinProxyResponse --from-beginning


# 3. Send request to generate new address
bin/kafka-console-producer.sh --broker-list localhost:9092 --topic bitcoinProxyRequest
{"data":{},"metadata":{"guid":"123","methodName":"getAddress","timestamp":"","context":""}}

# 4. Send request to make transaction
bin/kafka-console-producer.sh --broker-list localhost:9092 --topic bitcoinProxyRequest
{"data":{"to":"2NFpchMYyRTrY6eCr9YuiYQ62g6CdUjWfbk", "amount": "0.01"},"metadata":{"guid":"123","methodName":"sendTransaction","timestamp":"","context":""}}
```



### Bitcoind TestNet

To check out Bitcoin Proxy you can run the bitcoin node in testmode.
To get test bitcoins you can use [this](https://testnet.manu.backend.hamburg/faucet) free faucet.
You can check out transactions on [this](https://live.blockcypher.com/btc-testnet/tx/7eabc95193683097315a3716e8c08131a38e8717e63ff0845450d98063862670) address
To run testnode you have to create config file in `~/.bitcoin/bitcoin.conf`
```
pid=bitcoind.pid
gen=0
rpcuser=admin
rpcpassword=admin
rpcport=8332
daemon=1
testnet=1
txindex=1
zmqpubhashblock=tcp://127.0.0.1:28321
zmqpubhashtx=tcp://127.0.0.1:28321
```
After this just run `bitcoind` and the server will start as a deamon. To check if server is running just type `ps aux|grep bitcoind`    
To check disk usage use this command `du -sh ~/.bitcoin/testnet3/*`
On the day of writing this readme, at 01.08.2018 the blockchain size is 17GB

Shell Commands to talk with Bitcoin Node
```shell
# get latest block number (useful if you want to check blockchain sync status)
bitcoin-cli getblockcount

# create new address
bitcoin-cli getnewaddress

# get total balance
bitcoin-cli getbalance

# get balance of address
bitcoin-cli getbalance 2MvAnC4VePaPKYGU4SCiD32VcLcGtmvpkSn

# list bitcoin node addresses with money
bitcoin-cli listreceivedbyaddress 

# list all bitcoin node addresses
bitcoin-cli listreceivedbyaddress 0 true 

# send amount to address
bitcoin-cli sendtoaddress 2NFnF72aUKiA2QUkHS3p4WaaqfZa76q3njw 0.01

# get all new tx from mempool (with 0 confirmation)
bitcoin-cli getrawmempool
```



### Module loading

For modules loading inside the project we use [module-alias](https://www.npmjs.com/package/module-alias). For this we write in package.json
```json
  "_moduleAliases": {
    "@root": "dist",
    "@db": "dist/db",
    "@logic": "dist/logic"
  }
```
But this only for compiled javascript to work. In order to use this functionality in typescript and compile successfully, we use standartd
typescript functions. For this purpose we write in typescript config ts.config.json the following
```json
{
    "baseUrl": ".",
    "paths": {
      "@root/*": ["src/*"],
      "@db/*": ["src/db/*"],
      "@logic/*": ["src/logic/*"]
      }
}
```



## Authors

* **Gaydukov Dmitiry** - *Take a look* - [How to become a Senior Javascript Developer](https://github.com/dgaydukov/how-to-become-a-senior-js-developer)


