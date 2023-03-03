'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.po2json = po2json;
exports.extract = extract;
exports.generator = generator;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _walk = require('walk');

var _walk2 = _interopRequireDefault(_walk);

var _gettextParser = require('gettext-parser');

var _child_process = require('child_process');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function po2json(buffer, options) {
    options = options || {};
    var defaults = {
        pretty: false,
        fuzzy: false,
        stringify: false,
        format: 'raw',
        domain: 'messages',
        charset: 'utf8'
    };
    for (var property in defaults) {
        options[property] = 'undefined' !== typeof options[property] ? options[property] : defaults[property];
    }
    var parsed = _gettextParser.po.parse(buffer, defaults.charset);
    var contexts = parsed.translations;
    var result = {};
    Object.keys(contexts).forEach(function (context) {
        var translations = parsed.translations[context];
        var pluralForms = parsed.headers ? parsed.headers['plural-forms'] : '';

        Object.keys(translations).forEach(function (key) {
            var t = translations[key],
                translationKey = context.length ? context + '\x04' + key : key,
                fuzzy = t.comments && t.comments.flag && t.comments.flag.match(/fuzzy/) !== null;

            if (!fuzzy || options.fuzzy) {
                if (options.format === 'mf') {
                    result[translationKey] = t.msgstr[0];
                } else if (options.format === 'jed1.x') {
                    result[translationKey] = [t.msgid_plural ? t.msgid_plural : null].concat(t.msgstr);
                } else {
                    if (pluralForms === 'nplurals=1; plural=0;') {
                        result[translationKey] = [t.msgid_plural ? t.msgid_plural : null].concat(t.msgid_plural ? [t.msgstr] : t.msgstr);
                    } else {
                        result[translationKey] = [t.msgid_plural ? t.msgid_plural : null].concat(t.msgstr);
                    }
                }
            }

            // In the case of fuzzy or empty messages, use msgid(/msgid_plural)
            if (options['fallback-to-msgid'] && (fuzzy && !options.fuzzy || t.msgstr[0] === '')) {
                if (options.format === 'mf') {
                    result[translationKey] = key;
                } else {
                    result[translationKey] = [t.msgid_plural ? t.msgid_plural : null].concat(t.msgid_plural ? [key, t.msgid_plural] : [key]);
                }
            }
        });
    });
    if (parsed.headers) {
        result[''] = parsed.headers;
    }
    if (options.format === 'mf') {
        delete result[''];
    }
    if (options.format.indexOf('jed') === 0) {
        var jed = {
            domain: options.domain,
            locale_data: {}
        };
        if (options.format === 'jed1.x') {
            for (var key in result) {
                if (result.hasOwnProperty(key) && key !== '') {
                    for (var i = 2; i < result[key].length; i++) {
                        if ('' === result[key][i]) {
                            result[key][i] = result[key][0];
                        }
                    }
                    result[key].shift();
                }
            }
        }
        jed.locale_data[options.domain] = result;
        jed.locale_data[options.domain][''] = {
            domain: options.domain,
            plural_forms: result['']['plural-forms'],
            lang: result['']['language']
        };

        result = jed;
    }
    return options.stringify ? JSON.stringify(result, null, options.pretty ? '   ' : null) : result;
}

var async = function async(callback) {
    return new Promise(callback);
};

var asyncAll = function asyncAll(list) {
    return Promise.all(list);
};

var extend = function extend(target, source) {
    return Object.assign(target, source);
};

var flatten = function flatten(a) {
    var result = [];
    (function flat(a) {
        [].slice.call(a).forEach(function (i) {
            if (Array.isArray(i)) flat(i);else result.push(i);
        });
    })(a);
    return result;
};

var unique = function unique(arrArg) {
    return arrArg.filter(function (elem, pos, arr) {
        return arr.indexOf(elem) === pos;
    });
};

var execute = function execute(command, params) {
    return async(function (resolve, reject) {
        params = params.join(' ');
        (0, _child_process.exec)([command, params].join(' '), function (error, stdout) {
            if (error !== null) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
};

var fileExist = function fileExist(file) {
    return async(function (resolve, reject) {
        _fs2.default.open(file, 'r', function (error) {
            if (error) {
                reject();
            } else {
                resolve();
            }
        });
    });
};

var readFile = function readFile(file) {
    return _fs2.default.readFileSync(file).toString();
};

var createFolder = function createFolder(path) {
    _fsExtra2.default.ensureDirSync(path, {});
    return path;
};

var writeFile = function writeFile(file, content) {
    _fsExtra2.default.ensureFileSync(file);
    _fs2.default.writeFileSync(file, content);
};

var listFiles = function listFiles(folder) {
    if (Array.isArray(folder)) {
        var list = [];
        folder.forEach(function (path) {
            return list.push(listFiles(path));
        });
        return asyncAll(list).then(function () {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            return async(function (resolve) {
                return resolve(flatten(args));
            });
        });
    }
    return async(function (resolve, reject) {
        var walker = _walk2.default.walk(folder, { followLinks: false });
        var files = [];
        walker.on('file', function (root, file, next) {
            files.push(root + '/' + file.name);
            next();
        }).on('error', function (e) {
            reject(e);
        }).on('end', function () {
            resolve(files);
        });
    });
};

var xgettext = function xgettext(options) {
    var params = [];
    options = Object.assign({
        noLocation: false,
        omitHeader: false,
        charset: 'UTF-8',
        language: 'JavaScript',
        directory: false,
        potfile: 'template.pot',
        keywords: ['_']
    }, options);
    if (options.omitHeader) {
        params.push('--omit-header');
    }
    if (options.noLocation) {
        params.push('--no-location');
    }
    params.push('--force-po');
    if (options.charset) {
        params.push(['--from-code=', options.charset].join(''));
    }
    if (options.language) {
        params.push(['--language=', options.language].join(''));
    }
    params.push('--strict');
    params.push('--debug');

    if (options.directory) {
        params.push('-d');
        params.push(options.directory);
    }
    params.push('-o');
    params.push(options.potfile);
    if (options.keywords) {
        options.keywords.forEach(function (keyword) {
            params.push(['--keyword=', keyword].join(''));
        });
    }
    if (options.files) {
        params.push(options.files.join(' '));
    }
    return execute('xgettext', params);
};

var compile = function compile(pofile, mofile) {
    return execute('msgfmt', [pofile, '-o', mofile]);
};

var merge = function merge(pofile, potfile) {
    var command = void 0;
    var params = void 0;
    return fileExist(pofile).then(function () {
        command = 'msgmerge';
        params = ['-q', '-U', '--no-fuzzy-matching', '--previous', '--force-po', pofile, potfile];
        return execute(command, params);
    }, function () {
        command = 'cp';
        params = [potfile, pofile];
        return execute(command, params);
    });
};

var json = function json(pofile, jsonfile) {
    var content = readFile(pofile);
    var jsonData = po2json(content, { pretty: true, stringify: true, format: 'mf' });
    writeFile(jsonfile, jsonData);
};

var javascript = function javascript(ns, lang, jsonfile, jsfile) {
    var source = readFile(jsonfile);
    var format = '(function(n,k,v){this[n]=this[n]||{};this[n][k]=v})(%j,%j,%s);';
    var content = _util2.default.format(format, ns, lang, source.toString());
    writeFile(jsfile, content);
};

function extract(options) {
    options = extend({
        path: '.',
        target: './.locale',
        match: /_(?:\(|\s)(["'])(.+?)\1/g,
        replace: '_(\'$2\');'
    }, options);
    return listFiles(options.path).then(function (list) {
        var translation = [];
        var replace = options.replace;
        list.sort().forEach(function (file) {
            var source = readFile(file);
            var regexp = Array.isArray(options.match) ? options.match : [options.match];
            regexp.forEach(function (expr) {
                var matches = source.match(expr);
                if (matches) {
                    matches.forEach(function (item) {
                        item = item.trim();
                        if (replace) {
                            item = item.replace(expr, replace);
                        }
                        translation.push(item);
                    });
                }
            });
        });
        translation = unique(translation);
        writeFile(options.target, translation.join('\n'));
    });
}

function generator(options) {
    options = extend({
        namespace: 'i18n',
        filename: 'messages',
        language: 'JavaScript',
        domain: 'LC_MESSAGES',
        locales: [],
        keywords: [],
        source: [],
        noLocation: true,
        omitHeader: false,
        target: '.locales',
        charset: 'UTF-8'
    }, options);
    var list = options.locales.map(function (locale) {
        var folder = createFolder(_path2.default.join(options.target, locale, options.domain));
        var potfile = _path2.default.join(folder, [options.filename, 'pot'].join('.'));
        var pofile = _path2.default.join(folder, [options.filename, 'po'].join('.'));
        var mofile = _path2.default.join(folder, [options.filename, 'mo'].join('.'));
        var jsonfile = _path2.default.join(options.target, locale, [options.filename, 'json'].join('.'));
        var jsfile = _path2.default.join(options.target, locale, [options.filename, 'js'].join('.'));
        return listFiles(options.source).then(function (files) {
            return xgettext({
                files: files,
                potfile: potfile,
                noLocation: options.noLocation,
                omitHeader: options.omitHeader,
                keywords: options.keywords,
                language: options.language,
                charset: options.charset
            });
        }).then(function () {
            return merge(pofile, potfile);
        }).then(function () {
            return compile(pofile, mofile);
        }).then(function () {
            return json(pofile, jsonfile);
        }).then(function () {
            return javascript(options.namespace, locale, jsonfile, jsfile);
        }).then(function () {
            console.log('generate locale', locale);
        }).catch(function (e) {
            console.log(e);
        });
    });
    return asyncAll(list);
}