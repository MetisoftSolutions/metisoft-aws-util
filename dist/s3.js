"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const path_1 = __importDefault(require("path"));
const es6_promise_1 = require("es6-promise");
const multer = __importStar(require("multer"));
const image_size_1 = __importDefault(require("image-size"));
const fs = __importStar(require("fs"));
const moment_1 = __importDefault(require("moment"));
const uuid_1 = require("uuid");
function getUrlOfS3Object(region, bucketName, key) {
    return `https://s3.${region}.amazonaws.com/${bucketName}/${key}`;
}
exports.getUrlOfS3Object = getUrlOfS3Object;
function getS3KeyFromUrl(url) {
    const postDomain = url.split('amazonaws.com/')[1];
    const indexOfFirstSlash = postDomain.indexOf('/');
    const key = postDomain.slice(indexOfFirstSlash + 1);
    return key;
}
exports.getS3KeyFromUrl = getS3KeyFromUrl;
function collapseRequestFilesIntoArray(requestFiles) {
    let files = [];
    if (!lodash_1.default.isArray(requestFiles)) {
        requestFiles = lodash_1.default.reduce(requestFiles, (allFiles, value) => {
            allFiles = allFiles.concat(value);
            return allFiles;
        }, []);
    }
    else {
        files = requestFiles;
    }
    return files;
}
exports.collapseRequestFilesIntoArray = collapseRequestFilesIntoArray;
/**
 * Given a URL to a resource in the `s3` bucket, will get the objects key from
 * that URL and attempt to delete it.
 *
 * @param envConfigOptions
 *  used to get the name of the bucket to delete from
 * @param s3
 *  the S3 bucket object to delete from
 * @param url
 *  the URL of the resource
 */
function deleteObjectFromS3Bucket(s3, bucketName, url) {
    const params = {
        Bucket: bucketName,
        Key: getS3KeyFromUrl(url)
    };
    return new es6_promise_1.Promise((resolve, reject) => {
        s3.deleteObject(params, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.deleteObjectFromS3Bucket = deleteObjectFromS3Bucket;
function deleteObjectsFromS3Bucket(s3, bucketName, keys) {
    const request = {
        Bucket: bucketName,
        Delete: {
            Objects: lodash_1.default.map(keys, key => ({ Key: key }))
        }
    };
    return new es6_promise_1.Promise((resolve, reject) => {
        s3.deleteObjects(request, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.deleteObjectsFromS3Bucket = deleteObjectsFromS3Bucket;
function configMulterUploadObject(destinationPath, fileNamePrefix) {
    const storage = multer.diskStorage({
        destination: destinationPath,
        filename: (req, file, callback) => {
            callback(null, `${fileNamePrefix}-${uuid_1.v4()}`);
        }
    });
    return multer.default({ storage });
}
exports.configMulterUploadObject = configMulterUploadObject;
function uploadMulterImagesToS3(s3, userId, constraints, s3DirectoryName, bucketName, files) {
    return es6_promise_1.Promise.all(lodash_1.default.map(files, lodash_1.default.partial(uploadMulterImageToS3, s3, userId, constraints, s3DirectoryName, bucketName)));
}
exports.uploadMulterImagesToS3 = uploadMulterImagesToS3;
/**
 *
 * @param userId
 * @param constraints
 * @param directoryName
 * @param bucketName
 * @param file
 *
 * @returns
 *    S3 object key used to store the file.
 */
function uploadMulterImageToS3(s3, userId, constraints, s3DirectoryName, bucketName, file) {
    const filePath = path_1.default.join(file.destination, file.filename);
    const dimensions = image_size_1.default(filePath);
    const error = getConstraintsError(dimensions, file.size, constraints);
    if (error) {
        fs.unlinkSync(filePath);
        throw error;
    }
    return uploadMulterFileToS3(s3, userId, 0, s3DirectoryName, bucketName, file);
}
exports.uploadMulterImageToS3 = uploadMulterImageToS3;
function uploadMulterFileToS3(s3, userId, maxFileSizeKb, s3DirectoryName, bucketName, file) {
    const filePath = path_1.default.join(file.destination, file.filename);
    if (maxFileSizeKb > 0 && (file.size / 1024 > maxFileSizeKb)) {
        fs.unlinkSync(filePath);
        throw new Error('FILE_SIZE_TOO_BIG');
    }
    const fileExtension = __getFileExtension(file.originalname);
    let s3ObjectKey = '';
    const timestamp = moment_1.default().utc().format('YYYYMMDDTHHmmss');
    s3ObjectKey = `${s3DirectoryName}/${userId}.${timestamp}.${uuid_1.v4()}.${fileExtension}`;
    const s3Params = {
        ACL: 'public-read',
        Bucket: bucketName,
        Key: s3ObjectKey,
        Body: fs.readFileSync(filePath)
    };
    return new es6_promise_1.Promise((resolve, reject) => {
        s3.putObject(s3Params, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    })
        .then(() => {
        fs.unlinkSync(filePath);
        return s3ObjectKey;
    });
}
exports.uploadMulterFileToS3 = uploadMulterFileToS3;
function uploadFileToS3(args) {
    const request = {
        ACL: args.acl || 'private',
        Bucket: args.bucketName,
        Key: args.key,
        Body: args.binaryContents || args.textContents || ""
    };
    return new es6_promise_1.Promise((resolve, reject) => {
        args.s3.putObject(request, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    })
        .then(() => args.key);
}
exports.uploadFileToS3 = uploadFileToS3;
function downloadFileFromS3(args) {
    const request = {
        Bucket: args.bucketName,
        Key: args.key
    };
    return new es6_promise_1.Promise((resolve, reject) => {
        args.s3.getObject(request, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.downloadFileFromS3 = downloadFileFromS3;
function listFilesInDirectory(args) {
    const request = {
        Bucket: args.bucketName,
        Prefix: args.directoryName
    };
    return new es6_promise_1.Promise((resolve, reject) => {
        args.s3.listObjectsV2(request, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    })
        .then(retVal => lodash_1.default.compact(lodash_1.default.map(retVal.Contents, objectDescriptor => (objectDescriptor.Key || ''))))
        .then(fileList => lodash_1.default.compact(lodash_1.default.map(fileList, fileName => {
        if (fileName.startsWith(args.directoryName)) {
            return fileName.slice(args.directoryName.length);
        }
        return fileName;
    })));
}
exports.listFilesInDirectory = listFilesInDirectory;
function getSizeOfObject(s3, bucketName, key) {
    const args = {
        Bucket: bucketName,
        Key: key
    };
    return new es6_promise_1.Promise((resolve, reject) => {
        s3.headObject(args, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data.ContentLength || 0);
            }
        });
    });
}
exports.getSizeOfObject = getSizeOfObject;
function getRangeOfObject(s3, bucketName, key, startByte, endByte) {
    const args = {
        Bucket: bucketName,
        Key: key,
        Range: `bytes=${startByte}-${endByte}`
    };
    return new es6_promise_1.Promise((resolve, reject) => {
        s3.getObject(args, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.getRangeOfObject = getRangeOfObject;
function getChunkRequestFromRangeHeader(rangeHeader, fileSize) {
    const pieces = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(pieces[0], 10);
    const end = pieces[1] ?
        parseInt(pieces[1], 10) :
        fileSize - 1;
    const chunkSize = (end - start) + 1;
    return {
        start,
        end,
        chunkSize
    };
}
exports.getChunkRequestFromRangeHeader = getChunkRequestFromRangeHeader;
function __getFileExtension(fileName) {
    const namePieces = fileName.split('.');
    return namePieces[namePieces.length - 1];
}
function getConstraintsError(dimensions, fileSizeB, constraints) {
    if (constraints.minWidth && dimensions.width < constraints.minWidth) {
        return new Error('WIDTH_TOO_SMALL');
    }
    else if (constraints.maxWidth && dimensions.width > constraints.maxWidth) {
        return new Error('WIDTH_TOO_LARGE');
    }
    else if (constraints.minHeight && dimensions.height < constraints.minHeight) {
        return new Error('HEIGHT_TOO_SMALL');
    }
    else if (constraints.maxHeight && dimensions.height > constraints.maxHeight) {
        return new Error('HEIGHT_TOO_LARGE');
    }
    else if (constraints.maxFileSizeKb && (fileSizeB / 1024) > constraints.maxFileSizeKb) {
        return new Error('FILE_SIZE_TOO_LARGE');
    }
    else {
        return null;
    }
}
exports.getConstraintsError = getConstraintsError;
function parseExtraArgs(req) {
    let args;
    args = JSON.parse(req.body.extraArgs);
    if (!args) {
        throw new Error('NO_EXTRA_ARGS');
    }
    return args;
}
exports.parseExtraArgs = parseExtraArgs;
//# sourceMappingURL=s3.js.map