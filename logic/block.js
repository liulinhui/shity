'use strict';

const slots = require('../helpers/slots.js');
const crypto = require('crypto');
const shityjs = require('shity-js');
const bignum = require('../helpers/bignum.js');
const ByteBuffer = require('bytebuffer');
const BlockReward = require('../logic/blockReward.js');
const constants = require('../helpers/constants.js');

// Private fields
let __private = {}, genesisblock = null;

// Constructor
function Block(scope, cb) {
    this.scope = scope;
    genesisblock = this.scope.genesisblock;
    return cb && cb(null, this);
}

// Private methods
__private.blockReward = new BlockReward();

__private.getAddressByPublicKey = function (publicKey, network) {
    return shityjs.crypto.getAddress(publicKey, network.pubKeyHash);
};

// Public methods
//
//__API__ `create`

//
Block.prototype.create = function (data) {

    let transactions = data.transactions.sort(function compare(a, b) {
        if (a.type < b.type) {
            return -1;
        }
        if (a.type > b.type) {
            return 1;
        }
        if (a.id < b.id) {
            return -1;
        }
        if (a.id > b.id) {
            return 1;
        }
        return 0;
    });

    let nextHeight = (data.previousBlock) ? data.previousBlock.height + 1 : 1;


    let reward = __private.blockReward.calcReward(nextHeight),
        totalFee = 0, totalAmount = 0, size = 0;

    let blockTransactions = [];
    let payloadHash = crypto.createHash('sha256');

    for (let i = 0; i < transactions.length; i++) {
        let transaction = transactions[i];
        let bytes = new Buffer(transaction.id, "hex");

        if (size + bytes.length > constants.maxPayloadLength) {
            break;
        }

        size += bytes.length;

        totalFee += transaction.fee;
        totalAmount += transaction.amount;

        blockTransactions.push(transaction);
        payloadHash.update(bytes);
    }

    let block = {
        version: 0,
        height: nextHeight,
        totalAmount: totalAmount,
        totalFee: totalFee,
        reward: reward,
        payloadHash: payloadHash.digest().toString('hex'),
        timestamp: data.timestamp,
        numberOfTransactions: blockTransactions.length,
        payloadLength: size,
        previousBlock: data.previousBlock.id,
        generatorPublicKey: data.keypair.publicKey.toString('hex'),
        transactions: blockTransactions
    };
    block.blockSignature = this.sign(block, data.keypair);
    block = this.objectNormalize(block);
    block.id = this.getId(block);

    return block;
};

//
//__API__ `sign`

//
Block.prototype.sign = function (block, keypair) {
    let hash = this.getHash(block);

    return this.scope.crypto.sign(hash, keypair).toString('hex');
};

//
//__API__ `getBytes`

//
Block.prototype.getBytes = function (block, includeSignature) {
    if (includeSignature === undefined) {
        includeSignature = block.blockSignature !== undefined;
    }
    let size = 4 + 4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 33;
    let blockSignatureBuffer = null;

    if (includeSignature) {
        blockSignatureBuffer = new Buffer(block.blockSignature, 'hex');
        size += blockSignatureBuffer.length;
    }
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

        if (includeSignature) {
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

//
//__API__ `verifySignature`

//
Block.prototype.verifySignature = function (block) {
    let res;

    try {
        let data = this.getBytes(block, false);
        let hash = crypto.createHash('sha256').update(data).digest();
        let blockSignatureBuffer = new Buffer(block.blockSignature, 'hex');
        let generatorPublicKeyBuffer = new Buffer(block.generatorPublicKey, 'hex');

        res = this.scope.crypto.verify(hash, blockSignatureBuffer || ' ', generatorPublicKeyBuffer || ' ');
    } catch (e) {
        throw e;
    }

    return res;
};

Block.prototype.dbTable = 'blocks';

Block.prototype.dbFields = [
    'id',
    'version',
    'timestamp',
    'height',
    'previousBlock',
    'numberOfTransactions',
    'totalAmount',
    'totalFee',
    'reward',
    'payloadLength',
    'payloadHash',
    'generatorPublicKey',
    'blockSignature',
    'rawtxs'
];

//
//__API__ `dbSave`

//
Block.prototype.dbSave = function (block) {
    let payloadHash, generatorPublicKey, blockSignature, rawtxs;

    try {
        payloadHash = new Buffer(block.payloadHash, 'hex');
        generatorPublicKey = new Buffer(block.generatorPublicKey, 'hex');
        blockSignature = new Buffer(block.blockSignature, 'hex');
        rawtxs = JSON.stringify(block.transactions);
    } catch (e) {
        throw e;
    }

    return {
        table: this.dbTable,
        fields: this.dbFields,
        values: {
            id: block.id,
            version: block.version,
            timestamp: block.timestamp,
            height: block.height,
            previousBlock: block.previousBlock || null,
            numberOfTransactions: block.numberOfTransactions,
            totalAmount: block.totalAmount,
            totalFee: block.totalFee,
            reward: block.reward || 0,
            payloadLength: block.payloadLength,
            payloadHash: payloadHash,
            generatorPublicKey: generatorPublicKey,
            blockSignature: blockSignature,
            rawtxs: rawtxs
        }
    };
};

Block.prototype.schema = {
    id: 'Block',
    type: 'object',
    properties: {
        id: {
            type: 'string'
        },
        height: {
            type: 'integer'
        },
        blockSignature: {
            type: 'string',
            format: 'signature'
        },
        generatorPublicKey: {
            type: 'string',
            format: 'publicKey'
        },
        numberOfTransactions: {
            type: 'integer'
        },
        payloadHash: {
            type: 'string',
            format: 'hex'
        },
        payloadLength: {
            type: 'integer'
        },
        previousBlock: {
            type: 'string'
        },
        timestamp: {
            type: 'integer'
        },
        totalAmount: {
            type: 'integer',
            minimum: 0
        },
        totalFee: {
            type: 'integer',
            minimum: 0
        },
        reward: {
            type: 'integer',
            minimum: 0
        },
        transactions: {
            type: 'array',
            uniqueItems: true
        },
        version: {
            type: 'integer',
            minimum: 0
        }
    },
    required: ['blockSignature', 'generatorPublicKey', 'numberOfTransactions', 'payloadHash', 'payloadLength', 'timestamp', 'totalAmount', 'totalFee', 'reward', 'transactions', 'version']
};

//
//__API__ `objectNormalize`

//
Block.prototype.objectNormalize = function (block) {
    let i;

    for (i in block) {
        if (block[i] === null || typeof block[i] === 'undefined') {
            delete block[i];
        }
    }


    let report = this.scope.schema.validate(block, Block.prototype.schema);


    if (!report) {
        throw 'Failed to validate block schema: ' + this.scope.schema.getLastErrors().map(function (err) {
            return err.message;
        }).join(', ');
    }

    try {
        for (i = 0; i < block.transactions.length; i++) {
            block.transactions[i] = this.scope.transaction.objectNormalize(block.transactions[i]);
        }
    } catch (e) {
        throw e;
    }

    return block;
};

//
//__API__ `getId`

//
Block.prototype.getId = function (block) {
    let hash = crypto.createHash('sha256').update(this.getBytes(block)).digest();
    let temp = new Buffer(8);
    for (let i = 0; i < 8; i++) {
        temp[i] = hash[7 - i];
    }

    let id = bignum.fromBuffer(temp).toString();
    return id;
};

//
//__API__ `getHash`

//
Block.prototype.getHash = function (block) {
    return crypto.createHash('sha256').update(this.getBytes(block)).digest();
};

//
//__API__ `calculateFee`

//
Block.prototype.calculateFee = function (block) {
    return constants.fees.send;
};

//
//__API__ `dbRead`

//
Block.prototype.dbRead = function (raw) {
    if (!raw.b_id) {
        return null;
    } else {
        let block = {
            id: raw.b_id,
            version: parseInt(raw.b_version),
            timestamp: parseInt(raw.b_timestamp),
            height: parseInt(raw.b_height),
            previousBlock: raw.b_previousBlock,
            numberOfTransactions: parseInt(raw.b_numberOfTransactions),
            totalAmount: parseInt(raw.b_totalAmount),
            totalFee: parseInt(raw.b_totalFee),
            reward: parseInt(raw.b_reward),
            payloadLength: parseInt(raw.b_payloadLength),
            payloadHash: raw.b_payloadHash,
            generatorPublicKey: raw.b_generatorPublicKey,
            generatorId: __private.getAddressByPublicKey(raw.b_generatorPublicKey, this.scope.crypto.network),
            blockSignature: raw.b_blockSignature,
            confirmations: parseInt(raw.b_confirmations)
        };
        block.totalForged = bignum(block.totalFee).plus(bignum(block.reward)).toString();
        return block;
    }
};

// Export
module.exports = Block;
