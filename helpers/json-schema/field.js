'use strict';

const util = require('util');

module.exports = JsonSchemaField;

const Field = require('../validator').prototype.Field;

function JsonSchemaField(validator, path, value, rule, thisArg) {
    Field.call(this, validator, path, value, rule, thisArg);
}

util.inherits(JsonSchemaField, Field);
