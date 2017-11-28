'use strict';

const async = require('async');
const bignum = require('./bignum');
const fs = require('fs');
const path = require('path');

// let isWin = /^win/.test(process.platform);
// let isMac = /^darwin/.test(process.platform);

function Migrator(pgp, db) {
    this.checkMigrations = function (waterCb) {
        db.one('SELECT to_regclass(\'migrations\')').then(function (row) {
            return waterCb(null, Boolean(row.to_regclass));
        }).catch(function (err) {
            return waterCb(err);
        });
    };

    this.getLastMigration = function (hasMigrations, waterCb) {
        if (!hasMigrations) {
            return waterCb(null, null);
        }
        db.query('SELECT * FROM migrations ORDER BY "id" DESC LIMIT 1').then(function (rows) {
            if (rows[0]) {
                rows[0].id = bignum(rows[0].id);
            }
            return waterCb(null, rows[0]);
        }).catch(function (err) {
            return waterCb(err);
        });
    };

    this.readPendingMigrations = function (lastMigration, waterCb) {
        let migrationsPath = path.join(__dirname + '/../sql/migrations');
        let pendingMigrations = [];

        function matchMigrationName(file) {
            let name = file.match(/_.+\.sql$/);

            return Array.isArray(name) ? name[0].replace(/_/, '').replace(/\.sql$/, '') : null;
        }

        function matchMigrationId(file) {
            let id = file.match(/^[0-9]+/);

            return Array.isArray(id) ? bignum(id[0]) : null;
        }

        fs.readdir(migrationsPath, function (err, files) {
            if (err) {
                return waterCb(err);
            }

            files.map(function (file) {
                return {
                    id: matchMigrationId(file),
                    name: matchMigrationName(file),
                    path: path.join(migrationsPath, file)
                };
            }).filter(function (file) {
                return (
                    (file.id && file.name) && fs.statSync(file.path).isFile() && /\.sql$/.test(file.path)
                );
            }).forEach(function (file) {
                if (!lastMigration || file.id.greaterThan(lastMigration.id)) {
                    pendingMigrations.push(file);
                }
            });

            return waterCb(null, pendingMigrations);
        });
    };

    this.applyPendingMigrations = function (pendingMigrations, waterCb) {
        let appliedMigrations = [];

        async.eachSeries(pendingMigrations, function (file, eachCb) {
            let sql = new pgp.QueryFile(file.path, {minify: true});

            db.query(sql).then(function () {
                appliedMigrations.push(file);
                return eachCb();
            }).catch(function (err) {
                return eachCb(err);
            });
        }, function (err) {
            return waterCb(err, appliedMigrations);
        });
    };

    this.insertAppliedMigrations = function (appliedMigrations, waterCb) {
        async.eachSeries(appliedMigrations, function (file, eachCb) {
            db.query('INSERT INTO migrations(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING', [file.id.toString(), file.name]).then(function () {
                return eachCb();
            }).catch(function (err) {
                return eachCb(err);
            });
        }, function (err) {
            return waterCb(err);
        });
    };

    this.applyRuntimeQueryFile = function (waterCb) {
        let sql = new pgp.QueryFile(path.join(__dirname + '/../sql/runtime.sql'), {minify: true});

        db.query(sql).then(function () {
            return waterCb();
        }).catch(function (err) {
            return waterCb(err);
        });
    };
}

module.exports.connect = function (config, logger, cb) {
    let pgOptions = {
        pgNative: true
    };

    let pgp = require('pg-promise')(pgOptions);
    let monitor = require('pg-monitor');

    monitor.attach(pgOptions, config.logEvents);
    monitor.setTheme('matrix');

    monitor.log = function (msg, info) {
        logger.log(info.event, info.text);
        info.display = false;
    };

    config.user = config.user || process.env.USER;

    let db = pgp(config);
    let migrator = new Migrator(pgp, db);

    async.waterfall([
        migrator.checkMigrations,
        migrator.getLastMigration,
        migrator.readPendingMigrations,
        migrator.applyPendingMigrations,
        migrator.insertAppliedMigrations,
        migrator.applyRuntimeQueryFile
    ], function (err) {
        return cb(err, db);
    });
};
