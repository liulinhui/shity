const fs = require('fs');
const shityjs = require('shity-js');
const crypto = require('crypto');
const bip39 = require('bip39');
const ByteBuffer = require('bytebuffer');
const bignum = require('../helpers/bignum.js');

let config = {
    "port": 4000,
    "address": "127.0.0.1",
    "version": "0.3.0",
    "fileLogLevel": "info",
    "logFileName": "logs/shity.log",
    "consoleLogLevel": "debug",
    "trustProxy": false,
    "db": {
        "host": "localhost",
        "port": 5432,
        "database": "shity_test",
        "user": null,
        "password": "password",
        "poolSize": 20,
        "poolIdleTimeout": 30000,
        "reapIntervalMillis": 1000,
        "logEvents": [
            "error"
        ]
    },
    "api": {
        "mount": true,
        "access": {
            "whiteList": []
        },
        "options": {
            "limits": {
                "max": 0,
                "delayMs": 0,
                "delayAfter": 0,
                "windowMs": 60000
            }
        }
    },
    "peers": {
        "minimumNetworkReach":1,
        "list": [{"ip":"127.0.0.1", "port":4000}],
        "blackList": [],
        "options": {
            "limits": {
                "max": 0,
                "delayMs": 0,
                "delayAfter": 0,
                "windowMs": 60000
            },
            "maxUpdatePeers": 20,
            "timeout": 5000
        }
    },
    "forging": {
        "coldstart": 6,
        "force": true,
        "secret": [],
        "access": {
            "whiteList": [
                "127.0.0.1"
            ]
        }
    },
    "loading": {
        "verifyOnLoading": false,
        "loadPerIteration": 5000
    },
    "ssl": {
        "enabled": false,
        "options": {
            "port": 443,
            "address": "0.0.0.0",
            "key": "./ssl/ark.key",
            "cert": "./ssl/ark.crt"
        }
    }
};

sign = function (block, keypair) {
    let hash = getHash(block);
    return keypair.sign(hash).toDER().toString("hex");
};


getId = function (block) {
    let hash = crypto.createHash('sha256').update(getBytes(block)).digest();
    let temp = new Buffer(8);
    for (let i = 0; i < 8; i++) {
        temp[i] = hash[7 - i];
    }

    let id = bignum.fromBuffer(temp).toString();
    return id;
};

getHash = function (block) {
    return crypto.createHash('sha256').update(getBytes(block)).digest();
};


getBytes = function (block) {
    let size = 4 + 4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 66;
    let b, i;

    try {
        let bb = new ByteBuffer(size, true);
        bb.writeInt(block.version);
        bb.writeInt(block.timestamp);
        bb.writeInt(block.height);

        if (block.previousBlock) {
            let pb = bignum(block.previousBlock).toBuffer({size: '8'});

            for (i = 0; i < 8; i++) {
                bb.writeByte(pb[i]);
            }
        } else {
            for (i = 0; i < 8; i++) {
                bb.writeByte(0);
            }
        }

        bb.writeInt(block.numberOfTransactions);
        bb.writeLong(block.totalAmount);
        bb.writeLong(block.totalFee);
        bb.writeLong(block.reward);

        bb.writeInt(block.payloadLength);

        let payloadHashBuffer = new Buffer(block.payloadHash, 'hex');
        for (i = 0; i < payloadHashBuffer.length; i++) {
            bb.writeByte(payloadHashBuffer[i]);
        }

        let generatorPublicKeyBuffer = new Buffer(block.generatorPublicKey, 'hex');
        for (i = 0; i < generatorPublicKeyBuffer.length; i++) {
            bb.writeByte(generatorPublicKeyBuffer[i]);
        }

        if (block.blockSignature) {
            let blockSignatureBuffer = new Buffer(block.blockSignature, 'hex');
            for (i = 0; i < blockSignatureBuffer.length; i++) {
                bb.writeByte(blockSignatureBuffer[i]);
            }
        }

        bb.flip();
        b = bb.toBuffer();
    } catch (e) {
        throw e;
    }

    return b;
};

create = function (data) {
    let transactions = data.transactions.sort(function compare(a, b) {
        if (a.type < b.type) { return -1; }
        if (a.type > b.type) { return 1; }
        if (a.amount < b.amount) { return -1; }
        if (a.amount > b.amount) { return 1; }
        return 0;
    });

    let nextHeight = 1;

    let reward = 0,
        totalFee = 0, totalAmount = 0, size = 0;

    let blockTransactions = [];
    let payloadHash = crypto.createHash('sha256');

    for (let i = 0; i < transactions.length; i++) {
        let transaction = transactions[i];
        let bytes = shityjs.crypto.getBytes(transaction);

        size += bytes.length;

        totalFee += transaction.fee;
        totalAmount += transaction.amount;

        blockTransactions.push(transaction);
        payloadHash.update(bytes);
    }

    let block = {
        version: 0,
        totalAmount: totalAmount,
        totalFee: totalFee,
        reward: reward,
        payloadHash: payloadHash.digest().toString('hex'),
        timestamp: data.timestamp,
        numberOfTransactions: blockTransactions.length,
        payloadLength: size,
        previousBlock: null,
        generatorPublicKey: data.keypair.publicKey.toString('hex'),
        transactions: blockTransactions,
        height:1
    };

    block.id=getId(block);


    try {
        block.blockSignature = sign(block, data.keypair);
    } catch (e) {
        throw e;
    }

    return block;
}

let delegates = [];
let votes = [];
let transactions = [];

let genesis = {
    passphrase: bip39.generateMnemonic(),
    balance: 12500000000000000
}

let premine = {
    passphrase: bip39.generateMnemonic()
}

premine.publicKey = shityjs.crypto.getKeys(premine.passphrase).publicKey;
premine.address = shityjs.crypto.getAddress(premine.publicKey);

genesis.publicKey = shityjs.crypto.getKeys(genesis.passphrase).publicKey;
genesis.address = shityjs.crypto.getAddress(genesis.publicKey);
genesis.wif = shityjs.crypto.getKeys(genesis.passphrase).toWIF();

let premineTx = shityjs.transaction.createTransaction(genesis.address,genesis.balance,null, premine.passphrase)

premineTx.fee = 0;
premineTx.timestamp = 0;
premineTx.senderId = premine.address;
premineTx.signature = shityjs.crypto.sign(premineTx,shityjs.crypto.getKeys(genesis.passphrase));
premineTx.id = shityjs.crypto.getId(premineTx);

transactions.push(premineTx);

for(let i=1; i<52; i++){
    let delegate = {
        'passphrase': bip39.generateMnemonic(),
        'username': "genesis_"+i
    };

    let createDelegateTx = shityjs.delegate.createDelegate(delegate.passphrase, delegate.username);
    createDelegateTx.fee = 0;
    createDelegateTx.timestamp = 0;
    createDelegateTx.senderId = genesis.address;
    createDelegateTx.signature = shityjs.crypto.sign(createDelegateTx,shityjs.crypto.getKeys(delegate.passphrase));
    createDelegateTx.id = shityjs.crypto.getId(createDelegateTx);


    delegate.publicKey = createDelegateTx.senderPublicKey;
    delegate.address = shityjs.crypto.getAddress(createDelegateTx.senderPublicKey);

    votes.push("+"+delegate.publicKey)
    transactions.push(createDelegateTx);

    delegates.push(delegate);
}


let voteTransaction = shityjs.vote.createVote(genesis.passphrase,votes);
voteTransaction.fee = 0;
voteTransaction.timestamp = 0;
voteTransaction.senderId = genesis.address;
voteTransaction.signature = shityjs.crypto.sign(voteTransaction,shityjs.crypto.getKeys(genesis.passphrase));
voteTransaction.id = shityjs.crypto.getId(voteTransaction);

transactions.push(voteTransaction);


let genesisBlock = create({
    keypair: shityjs.crypto.getKeys(genesis.passphrase),
    transactions:transactions,
    timestamp:0
});

for(let i=0;i<51;i++){
    config.forging.secret.push(delegates[i].passphrase);
}

config.nethash = genesisBlock.payloadHash;


fs.writeFile("private/genesisBlock.json",JSON.stringify(genesisBlock, null, 2));
fs.writeFile("private/config.json",JSON.stringify(config, null, 2));
fs.writeFile("private/delegatesPassphrases.json", JSON.stringify(delegates, null, 2));
fs.writeFile("private/genesisPassphrase.json", JSON.stringify(genesis, null, 2));
