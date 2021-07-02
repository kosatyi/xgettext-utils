import {exec} from 'child_process';
import fs from 'fs';
import fse from 'fs-extra';
import util from 'util';
import walk from 'walk';
import path from 'path';
import po2json from 'po2json';

const async = (callback) => {
    return new Promise(callback);
}

const asyncAll = (list) => {
    return Promise.all(list);
}

const extend = (target, source) => {
    return Object.assign(target, source);
}

const execute = (command, params) => {
    return async((resolve, reject) => {
        params = params.join(' ');
        exec([command, params].join(' '), (error, stdout) => {
            if (error !== null) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    })
}

const flatten = (a) => {
    let result = [];
    (function flat(a) {
        [].slice.call(a).forEach((i) => {
            if (Array.isArray(i)) flat(i);
            else result.push(i);
        });
    })(a);
    return result;
}

const unique = (arrArg) => {
    return arrArg.filter((elem, pos, arr) => {
        return arr.indexOf(elem) === pos;
    });
};

const fileExist = (file) => {
    return async((resolve, reject) => {
        fs.open(file, 'r', function (error) {
            if (error) {
                reject();
            } else {
                resolve();
            }
        });
    })
}

const readFile = (file) => fs.readFileSync(file).toString();


const createFolder = (path) => {
    fse.ensureDirSync(path);
    return path;
}

const writeFile = (file, content) => {
    fse.ensureFileSync(file);
    fs.writeFileSync(file, content);
}

const listFiles = function (folder) {
    if (Array.isArray(folder)) {
        let list = [];
        folder.forEach((path) => list.push(listFiles(path)));
        return asyncAll(list).then((...args) => {
            return async((resolve) => resolve(flatten(args)))
        });
    }
    return async((resolve, reject) => {
        let walker = walk.walk(folder, {followLinks: false});
        let files = [];
        walker.on('file', function (root, file, next) {
            files.push(root + '/' + file.name);
            next();
        }).on('error', (e) => {
            reject(e);
        }).on('end', () => {
            resolve(files);
        });
    });
}

const xgettext = (options) => {
    let params = [];
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
}

const compile = (pofile, mofile) => {
    return execute('msgfmt', [pofile, '-o', mofile]);
}

const merge = (pofile, potfile) => {
    let command;
    let params;
    return fileExist(pofile).then(() => {
        command = 'msgmerge'
        params = ['-q', '-U', '--no-fuzzy-matching', '--previous', '--force-po', pofile, potfile];
        return execute(command, params);
    }, () => {
        command = 'cp'
        params = [potfile, pofile];
        return execute(command, params);
    });
}

const json = (pofile, jsonfile) => {
    let content = readFile(pofile);
    let jsonData = po2json.parse(content, {pretty: true, stringify: true, format: 'mf'});
    writeFile(jsonfile, jsonData);
}

const javascript = (ns, lang, jsonfile, jsfile) => {
    let source = readFile(jsonfile);
    let format = '(function(n,k,v){this[n]=this[n]||{};this[n][k]=v})(%j,%j,%s);';
    let content = util.format(format, ns, lang, source.toString());
    writeFile(jsfile, content);
}

const extract = (options) => {
    options = extend({
        path: '.',
        target: './.locale',
        match: /_(?:\(|\s)(["'])(.+?)\1/g,
        replace: '_(\'$2\');'
    }, options);
    return listFiles(options.path).then((list) => {
        let translation = [];
        list.forEach((file) => {
            let source = readFile(file);
            let matches = source.match(options.match);
            if (matches)
                translation = translation.concat(matches);
        });
        translation = translation.map((item) => {
            item = item.trim();
            if (options.replace)
                item = item.replace(options.match, options.replace);
            return item;
        })
        translation = unique(translation);
        writeFile(options.target, translation.join('\n'));
    });
}

const generator = function (options) {
    options = extend({
        namespace: 'i18n',
        filename: 'messages',
        language: 'JavaScript',
        domain: 'LC_MESSAGES',
        locales: [],
        keywords: [],
        source: [],
        noLocation: true,
        omitHeader: true,
        target: '.locales',
        charset: 'UTF-8'
    }, options);
    let list = options.locales.map((locale) => {
        let folder = createFolder(path.join(options.target, locale, options.domain));
        let potfile = path.join(folder, [options.filename, 'pot'].join('.'));
        let pofile = path.join(folder, [options.filename, 'po'].join('.'));
        let mofile = path.join(folder, [options.filename, 'mo'].join('.'));
        let jsonfile = path.join(options.target, locale, [options.filename, 'json'].join('.'));
        let jsfile = path.join(options.target, locale, [options.filename, 'js'].join('.'));
        return listFiles(options.source).then((files) =>
            xgettext({
                files: files,
                potfile: potfile,
                noLocation: options.noLocation,
                omitHeader: options.omitHeader,
                keywords: options.keywords,
                language: options.language,
                charset: options.charset
            })
        ).then(() => merge(pofile, potfile))
            .then(() => compile(pofile, mofile))
            .then(() => json(pofile, jsonfile))
            .then(() => javascript(options.namespace, locale, jsonfile, jsfile))
            .then(() => {
                console.log('generate locale', locale);
            }).catch((e) => {
                console.log(e);
            });
    });
    return asyncAll(list);
}

exports.extract = extract;

exports.generator = generator;