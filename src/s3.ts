import _ from 'lodash'
import path from 'path';
import { Promise } from 'es6-promise';
import * as multer from 'multer';
import imageSize from 'image-size';
import * as fs from 'fs';
import * as aws from 'aws-sdk';
import moment from 'moment';
import { v4 as uuidV4 } from 'uuid';
import * as express from 'express';



export interface IImageConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxFileSizeKb?: number;
}



export function getUrlOfS3Object(region: string, bucketName: string, key: string) {
  return `https://s3.${region}.amazonaws.com/${bucketName}/${key}`;
}



export function getS3KeyFromUrl(url: string) {
  const postDomain = url.split('amazonaws.com/')[1];
  const indexOfFirstSlash = postDomain.indexOf('/');
  const key = postDomain.slice(indexOfFirstSlash+1);
  return key;
}



export function collapseRequestFilesIntoArray(requestFiles: Express.Request['files']) {
  let files: Express.Multer.File[] = [];

  if (!_.isArray(requestFiles)) {
    requestFiles = _.reduce(requestFiles, (allFiles, value) => {
      allFiles = allFiles.concat(value);
      return allFiles;
    }, [] as Express.Multer.File[]);

  } else {
    files = requestFiles as Express.Multer.File[];
  }

  return files;
}



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
export function deleteObjectFromS3Bucket(s3: aws.S3, bucketName: string, url: string): Promise<aws.S3.DeleteObjectOutput | null> {
  const params: aws.S3.DeleteObjectRequest = {
    Bucket: bucketName,
    Key: getS3KeyFromUrl(url)
  };

  return new Promise((resolve, reject) => {
    s3.deleteObject(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}



export function configMulterUploadObject(
  destinationPath: string,
  fileNamePrefix: string
) {
  const storage = multer.diskStorage({
    destination: destinationPath,
    filename: (req, file, callback) => {
      callback(null, `${fileNamePrefix}-${uuidV4()}`);
    }
  });
  return multer.default({storage});
}



export function uploadImagesToS3(
  s3: aws.S3,
  userId: string,
  constraints: IImageConstraints,
  s3DirectoryName: string,
  bucketName: string,
  files: Express.Multer.File[]
): Promise<string[]> {
  return Promise.all(
    _.map(files, _.partial(uploadImageToS3, s3, userId, constraints, s3DirectoryName, bucketName))
  );
}



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
export function uploadImageToS3(
  s3: aws.S3,
  userId: string,
  constraints: IImageConstraints,
  s3DirectoryName: string,
  bucketName: string,
  file: Express.Multer.File
): Promise<string> {
  const filePath = path.join(file.destination, file.filename);
  const dimensions = imageSize(filePath);
  const fileExtension = __getFileExtension(file.originalname);
  let s3ObjectKey = '';

  const error = getConstraintsError(dimensions, file.size, constraints);
  if (error) {
    fs.unlinkSync(filePath);
    throw error;
  }

  const timestamp = moment().utc().format('YYYYMMDDTHHmmss');
  s3ObjectKey = `${s3DirectoryName}/${userId}.${timestamp}.${uuidV4()}.${fileExtension}`;

  const s3Params: aws.S3.PutObjectRequest = {
    ACL: 'public-read',
    Bucket: bucketName,
    Key: s3ObjectKey,
    Body: fs.readFileSync(filePath)
  };

  return new Promise((resolve, reject) => {
      s3.putObject(s3Params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    })

    .then(() => {
      fs.unlinkSync(filePath);
      return s3ObjectKey;
    });
}



function __getFileExtension(fileName: string) {
  const namePieces = fileName.split('.');
  return namePieces[namePieces.length-1];
}



export function getConstraintsError(dimensions: {width: number, height: number}, fileSizeB: number, constraints: IImageConstraints): Error | null {
  if (constraints.minWidth && dimensions.width < constraints.minWidth) {
    return new Error('WIDTH_TOO_SMALL');
  } else if (constraints.maxWidth && dimensions.width > constraints.maxWidth) {
    return new Error('WIDTH_TOO_LARGE');
  } else if (constraints.minHeight && dimensions.height < constraints.minHeight) {
    return new Error('HEIGHT_TOO_SMALL');
  } else if (constraints.maxHeight && dimensions.height > constraints.maxHeight) {
    return new Error('HEIGHT_TOO_LARGE');
  } else if (constraints.maxFileSizeKb && (fileSizeB / 1024) > constraints.maxFileSizeKb) {
    return new Error('FILE_SIZE_TOO_LARGE');
  } else {
    return null;
  }
}



export function parseExtraArgs(req: express.Request) {
  let args: any;

  args = JSON.parse(req.body.extraArgs);
  if (!args) {
    throw new Error('NO_EXTRA_ARGS');
  }
  
  return args;
}
