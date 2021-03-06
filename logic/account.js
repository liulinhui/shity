'use strict';

const async = require('async');
const pgp = require('pg-promise');
const path = require('path');
const jsonSql = require('json-sql')();
jsonSql.setDialect('postgresql');
const constants = require('../helpers/constants.js');
const slots = require('../helpers/slots.js');

// Private fields
let self, db, library, __private = {}, genesisBlock = null;

// Constructor
function Account(scope, cb) {
    this.scope = scope;

    self = this;
    db = this.scope.db;
    library = this.scope.library;
    genesisBlock = this.scope.genesisblock.block;

    this.table = 'mem_accounts';

    this.model = [
        {
            name: 'username',
            type: 'String',
            filter: {
                type: 'string',
                case: 'lower',
                maxLength: 20,
                minLength: 1
            },
            conv: String,
            immutable: true
        },
        {
            name: 'isDelegate',
            type: 'SmallInt',
            filter: {
                type: 'boolean'
            },
            conv: Boolean
        },
        {
            name: 'u_isDelegate',
            type: 'SmallInt',
            filter: {
                type: 'boolean'
            },
            conv: Boolean
        },
        {
            name: 'secondSignature',
            type: 'SmallInt',
            filter: {
                type: 'boolean'
            },
            conv: Boolean
        },
        {
            name: 'u_secondSignature',
            type: 'SmallInt',
            filter: {
                type: 'boolean'
            },
            conv: Boolean
        },
        {
            name: 'u_username',
            type: 'String',
            filter: {
                type: 'string',
                case: 'lower',
                maxLength: 20,
                minLength: 1
            },
            conv: String,
            immutable: true
        },
        {
            name: 'address',
            type: 'String',
            filter: {
                required: true,
                type: 'string',
                format: 'address'
            },
            conv: String,
            immutable: true
        },
        {
            name: 'publicKey',
            type: 'Binary',
            filter: {
                type: 'string',
                format: 'publicKey'
            },
            conv: String,
            immutable: true,
            expression: 'ENCODE("publicKey", \'hex\')'
        },
        {
            name: 'secondPublicKey',
            type: 'Binary',
            filter: {
                type: 'string',
                format: 'publicKey'
            },
            conv: String,
            immutable: true,
            expression: 'ENCODE("secondPublicKey", \'hex\')'
        },
        {
            name: 'balance',
            type: 'BigInt',
            filter: {
                required: true,
                type: 'integer',
                minimum: 0,
                maximum: constants.totalAmount
            },
            conv: Number,
            expression: '("balance")::bigint'
        },
        {
            name: 'u_balance',
            type: 'BigInt',
            filter: {
                required: true,
                type: 'integer',
                minimum: 0,
                maximum: constants.totalAMount
            },
            conv: Number,
            expression: '("u_balance")::bigint'
        },
        {
            name: 'vote',
            type: 'BigInt',
            filter: {
                type: 'integer'
            },
            conv: Number,
            expression: '("vote")::bigint'
        },
        {
            name: 'rate',
            type: 'BigInt',
            filter: {
                type: 'integer'
            },
            conv: Number,
            expression: '("rate")::bigint'
        },
        {
            name: 'delegates',
            type: 'Text',
            filter: {
                type: 'array',
                uniqueItems: true
            },
            conv: Array,
            expression: '(SELECT ARRAY_AGG("dependentId") FROM ' + this.table + '2delegates WHERE "accountId" = a."address")'
        },
        {
            name: 'u_delegates',
            type: 'Text',
            filter: {
                type: 'array',
                uniqueItems: true
            },
            conv: Array,
            expression: '(SELECT ARRAY_AGG("dependentId") FROM ' + this.table + '2u_delegates WHERE "accountId" = a."address")'
        },
        {
            name: 'multisignatures',
            type: 'Text',
            filter: {
                type: 'array',
                uniqueItems: true
            },
            conv: Array,
            expression: '(SELECT ARRAY_AGG("dependentId") FROM ' + this.table + '2multisignatures WHERE "accountId" = a."address")'
        },
        {
            name: 'u_multisignatures',
            type: 'Text',
            filter: {
                type: 'array',
                uniqueItems: true
            },
            conv: Array,
            expression: '(SELECT ARRAY_AGG("dependentId") FROM ' + this.table + '2u_multisignatures WHERE "accountId" = a."address")'
        },
        {
            name: 'multimin',
            type: 'SmallInt',
            filter: {
                type: 'integer',
                minimum: 0,
                maximum: 17
            },
            conv: Number
        },
        {
            name: 'u_multimin',
            type: 'SmallInt',
            filter: {
                type: 'integer',
                minimum: 0,
                maximum: 17
            },
            conv: Number
        },
        {
            name: 'multilifetime',
            type: 'SmallInt',
            filter: {
                type: 'integer',
                minimum: 1,
                maximum: 72
            },
            conv: Number
        },
        {
            name: 'u_multilifetime',
            type: 'SmallInt',
            filter: {
                type: 'integer',
                minimum: 1,
                maximum: 72
            },
            conv: Number
        },
        {
            name: 'blockId',
            type: 'String',
            filter: {
                type: 'string',
                minLength: 1,
                maxLength: 20
            },
            conv: String
        },
        {
            name: 'nameexist',
            type: 'SmallInt',
            filter: {
                type: 'boolean'
            },
            conv: Boolean
        },
        {
            name: 'u_nameexist',
            type: 'SmallInt',
            filter: {
                type: 'boolean'
            },
            conv: Boolean
        },
        {
            name: 'producedblocks',
            type: 'Number',
            filter: {
                type: 'integer',
                minimum: -1,
                maximum: 1
            },
            conv: Number
        },
        {
            name: 'missedblocks',
            type: 'Number',
            filter: {
                type: 'integer',
                minimum: -1,
                maximum: 1
            },
            conv: Number
        },
        {
            name: 'fees',
            type: 'BigInt',
            filter: {
                type: 'integer'
            },
            conv: Number,
            expression: '("fees")::bigint'
        },
        {
            name: 'rewards',
            type: 'BigInt',
            filter: {
                type: 'integer'
            },
            conv: Number,
            expression: '("rewards")::bigint'
        },
        {
            name: 'virgin',
            type: 'SmallInt',
            filter: {
                type: 'boolean'
            },
            conv: Boolean,
            immutable: true
        }
    ];

    this.fields = this.model.map(function (field) {
        let _tmp = {};

        if (field.expression) {
            _tmp.expression = field.expression;
        } else {
            if (field.mod) {
                _tmp.expression = field.mod;
            }
            _tmp.field = field.name;
        }
        if (_tmp.expression || field.alias) {
            _tmp.alias = field.alias || field.name;
        }

        return _tmp;
    });

    this.binary = [];
    this.model.forEach(function (field) {
        if (field.type === 'Binary') {
            this.binary.push(field.name);
        }
    }.bind(this));

    this.filter = {};
    this.model.forEach(function (field) {
        this.filter[field.name] = field.filter;
    }.bind(this));

    this.conv = {};
    this.model.forEach(function (field) {
        this.conv[field.name] = field.conv;
    }.bind(this));

    this.editable = [];
    this.model.forEach(function (field) {
        if (!field.immutable) {
            this.editable.push(field.name);
        }
    }.bind(this));

    return cb(null, this);
}

//
//__API__ `createTables`

//
Account.prototype.createTables = function (cb) {
    // let sql = new pgp.QueryFile(path.join('sql', 'memoryTables.sql'), {minify: true});
    //
    // db.query(sql).then(function () {
    // 	return cb();
    // }).catch(function (err) {
    // 	library.logger.error("stack", err.stack);
    // 	return cb('Account#createTables error');
    // });
    return cb();
};

//
//__API__ `removeTables`

//
Account.prototype.removeTables = function (cb) {
    let sqles = [], sql;

    [this.table,
        'mem_delegates',
        'mem_accounts2delegates',
        'mem_accounts2u_delegates',
        'mem_accounts2multisignatures',
        'mem_accounts2u_multisignatures'].forEach(function (table) {
        sql = jsonSql.build({
            type: 'remove',
            table: table
        });
        sqles.push(sql.query);
    });

    db.query(sqles.join('')).then(function () {
        return cb();
    }).catch(function (err) {
        library.logger.error("stack", err.stack);
        return cb('Account#removeTables error');
    });
};

//
//__API__ `objectNormalize`

//
Account.prototype.objectNormalize = function (account) {
    let report = this.scope.schema.validate(account, {
        id: 'Account',
        object: true,
        properties: this.filter
    });

    if (!report) {
        throw 'Failed to validate account schema: ' + this.scope.schema.getLastErrors().map(function (err) {
            return err.message;
        }).join(', ');
    }

    return account;
};

//
//__API__ `verifyPublicKey`

//
Account.prototype.verifyPublicKey = function (publicKey) {
    if (publicKey !== undefined) {
        // Check type
        if (typeof publicKey !== 'string') {
            throw 'Invalid public key, must be a string';
        }
        // Check length
        if (publicKey.length < 66) {
            throw 'Invalid public key, must be 65 characters long';
        }
        // Check format
        try {
            new Buffer(publicKey, 'hex');
        } catch (e) {
            throw 'Invalid public key, must be a hex string';
        }
    }
};

//
//__API__ `toDB`

//
Account.prototype.toDB = function (raw) {
    this.binary.forEach(function (field) {
        if (raw[field]) {
            raw[field] = new Buffer(raw[field], 'hex');
        }
    });

    return raw;
};

//
//__API__ `get`

//
Account.prototype.get = function (filter, fields, cb) {
    if (typeof(fields) === 'function') {
        cb = fields;
        fields = this.fields.map(function (field) {
            return field.alias || field.field;
        });
    }

    this.getAll(filter, fields, function (err, data) {
        return cb(err, data && data.length ? data[0] : null);
    });
};

//
//__API__ `getAll`

//
Account.prototype.getAll = function (filter, fields, cb) {
    if (typeof(fields) === 'function') {
        cb = fields;
        fields = this.fields.map(function (field) {
            return field.alias || field.field;
        });
    }

    let realFields = this.fields.filter(function (field) {
        return fields.indexOf(field.alias || field.field) !== -1;
    });

    let realConv = {};
    Object.keys(this.conv).forEach(function (key) {
        if (fields.indexOf(key) !== -1) {
            realConv[key] = this.conv[key];
        }
    }.bind(this));

    let limit, offset, sort;

    if (filter.limit > 0) {
        limit = filter.limit;
    }
    delete filter.limit;

    if (filter.offset > 0) {
        offset = filter.offset;
    }
    delete filter.offset;

    if (filter.sort) {
        sort = filter.sort;
    }
    delete filter.sort;

    let sql = jsonSql.build({
        type: 'select',
        table: this.table,
        limit: limit,
        offset: offset,
        sort: sort,
        alias: 'a',
        condition: filter,
        fields: realFields
    });

    db.query(sql.query, sql.values).then(function (rows) {
        return cb(null, rows);
    }).catch(function (err) {
        library.logger.error("stack", err.stack);
        return cb('Account#getAll error');
    });
};

//
//__API__ `set`

//
Account.prototype.set = function (address, fields, cb) {
    // Verify public key
    this.verifyPublicKey(fields.publicKey);

    fields.address = address;

    let sql = jsonSql.build({
        type: 'insertorupdate',
        table: this.table,
        conflictFields: ['address'],
        values: this.toDB(fields),
        modifier: this.toDB(fields)
    });

    db.none(sql.query, sql.values).then(function () {
        return cb();
    }).catch(function (err) {
        library.logger.error("stack", err.stack);
        return cb('Account#set error');
    });
};


//
//__API__ `merge`

//
Account.prototype.merge = function (address, diff, cb) {
    let update = {}, remove = {}, insert = {}, insert_object = {}, remove_object = {}, round = [];

    // Verify public key
    this.verifyPublicKey(diff.publicKey);


    this.editable.forEach(function (value) {
        let val, i;

        if (diff[value] !== undefined) {
            let trueValue = diff[value];
            switch (self.conv[value]) {
                case String:
                    update[value] = trueValue;
                    break;
                case Number:
                    if (isNaN(trueValue) || trueValue === Infinity) {
                        return cb('Encountered unsane number: ' + trueValue);
                    }
                    else if (Math.abs(trueValue) === trueValue && trueValue !== 0) {
                        update.$inc = update.$inc || {};
                        update.$inc[value] = Math.floor(trueValue);
                    }
                    else if (trueValue < 0) {
                        update.$dec = update.$dec || {};
                        update.$dec[value] = Math.floor(Math.abs(trueValue));
                        // If decrementing u_balance on account
                        if (update.$dec.u_balance) {
                            // Remove virginity and ensure marked columns become immutable
                            update.virgin = 0;
                        }
                    }
                    break;
                case Array:
                    if (Object.prototype.toString.call(trueValue[0]) === '[object Object]') {
                        for (i = 0; i < trueValue.length; i++) {
                            val = trueValue[i];
                            if (val.action === '-') {
                                delete val.action;
                                remove_object[value] = remove_object[value] || [];
                                remove_object[value].push(val);
                            } else if (val.action === '+') {
                                delete val.action;
                                insert_object[value] = insert_object[value] || [];
                                insert_object[value].push(val);
                            } else {
                                delete val.action;
                                insert_object[value] = insert_object[value] || [];
                                insert_object[value].push(val);
                            }
                        }
                    } else {
                        for (i = 0; i < trueValue.length; i++) {
                            let math = trueValue[i][0];
                            val = null;
                            if (math === '-') {
                                val = trueValue[i].slice(1);
                                remove[value] = remove[value] || [];
                                remove[value].push(val);
                            }
                            else if (math === '+') {
                                val = trueValue[i].slice(1);
                                insert[value] = insert[value] || [];
                                insert[value].push(val);
                            } else {
                                val = trueValue[i];
                                insert[value] = insert[value] || [];
                                insert[value].push(val);
                            }
                        }
                    }
                    break;
            }
        }
    });

    let sqles = [];

    if (Object.keys(remove).length) {
        Object.keys(remove).forEach(function (el) {
            let sql = jsonSql.build({
                type: 'remove',
                table: self.table + '2' + el,
                condition: {
                    dependentId: {$in: remove[el]},
                    accountId: address
                }
            });
            sqles.push(sql);
        });
    }

    if (Object.keys(insert).length) {
        Object.keys(insert).forEach(function (el) {
            for (let i = 0; i < insert[el].length; i++) {
                let sql = jsonSql.build({
                    type: 'insert',
                    table: self.table + '2' + el,
                    values: {
                        accountId: address,
                        dependentId: insert[el][i]
                    }
                });
                sqles.push(sql);
            }
        });
    }

    if (Object.keys(remove_object).length) {
        Object.keys(remove_object).forEach(function (el) {
            remove_object[el].accountId = address;
            let sql = jsonSql.build({
                type: 'remove',
                table: self.table + '2' + el,
                condition: remove_object[el]
            });
            sqles.push(sql);
        });
    }

    if (Object.keys(insert_object).length) {
        Object.keys(insert_object).forEach(function (el) {
            insert_object[el].accountId = address;
            for (let i = 0; i < insert_object[el].length; i++) {
                let sql = jsonSql.build({
                    type: 'insert',
                    table: self.table + '2' + el,
                    values: insert_object[el]
                });
                sqles.push(sql);
            }
        });
    }

    if (Object.keys(update).length) {
        let sql = jsonSql.build({
            type: 'update',
            table: this.table,
            modifier: update,
            condition: {
                address: address
            }
        });
        sqles.push(sql);
    }

    function done(err) {
        if (cb.length !== 2) {
            return cb(err);
        } else {
            if (err) {
                return cb(err);
            }
            self.get({address: address}, cb);
        }
    }

    let queries = sqles.map(function (sql) {
        return pgp.as.format(sql.query, sql.values);
    }).join('');

    if (!cb) {
        return queries;
    }

    if (queries.length === 0) {
        return done();
    }

    db.none(queries).then(function () {
        return done();
    }).catch(function (err) {
        library.logger.error("stack", err.stack);
        return done('Account#merge error');
    });
};

//
//__API__ `remove`

//
Account.prototype.remove = function (address, cb) {
    let sql = jsonSql.build({
        type: 'remove',
        table: this.table,
        condition: {
            address: address
        }
    });
    db.none(sql.query, sql.values).then(function () {
        return cb(null, address);
    }).catch(function (err) {
        library.logger.error("stack", err.stack);
        return cb('Account#remove error');
    });
};

// Export
module.exports = Account;
