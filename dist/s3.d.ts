/// <reference types="express-serve-static-core" />
import { Promise } from 'es6-promise';
import * as multer from 'multer';
import * as aws from 'aws-sdk';
import * as express from 'express';
export interface IImageConstraints {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    maxFileSizeKb?: number;
}
export declare function getUrlOfS3Object(region: string, bucketName: string, key: string): string;
export declare function getS3KeyFromUrl(url: string): string;
export declare function collapseRequestFilesIntoArray(requestFiles: Express.Request['files']): Express.Multer.File[];
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
export declare function deleteObjectFromS3Bucket(s3: aws.S3, bucketName: string, url: string): Promise<aws.S3.DeleteObjectOutput | null>;
export declare function configMulterUploadObject(destinationPath: string, fileNamePrefix: string): multer.Instance;
export declare function uploadImagesToS3(s3: aws.S3, userId: string, constraints: IImageConstraints, s3DirectoryName: string, bucketName: string, files: Express.Multer.File[]): Promise<string[]>;
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
export declare function uploadImageToS3(s3: aws.S3, userId: string, constraints: IImageConstraints, s3DirectoryName: string, bucketName: string, file: Express.Multer.File): Promise<string>;
export declare function uploadFileToS3(s3: aws.S3, userId: string, maxFileSizeKb: number, s3DirectoryName: string, bucketName: string, file: Express.Multer.File): Promise<string>;
export declare function getSizeOfObject(s3: aws.S3, bucketName: string, key: string): Promise<number>;
export declare function getRangeOfObject(s3: aws.S3, bucketName: string, key: string, startByte: number, endByte: number): Promise<aws.S3.GetObjectOutput>;
export interface IChunkRequest {
    start: number;
    end: number;
    chunkSize: number;
}
export declare function getChunkRequestFromRangeHeader(rangeHeader: string, fileSize: number): IChunkRequest;
export declare function getConstraintsError(dimensions: {
    width: number;
    height: number;
}, fileSizeB: number, constraints: IImageConstraints): Error | null;
export declare function parseExtraArgs(req: express.Request): any;
