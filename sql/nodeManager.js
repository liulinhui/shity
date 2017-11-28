'use strict';

let NodeManagerSql = {
  getTransactionId: 'SELECT "id" FROM transactions WHERE "id" = ${id}'
};

module.exports = NodeManagerSql;
