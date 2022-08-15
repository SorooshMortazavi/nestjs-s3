import { Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { readFileSync } from 'fs';

@Injectable()
export class S3Service {
  s3: S3;
  constructor() {
    this.s3 = new S3({
      endpoint: 's3.eu-west-1.wasabisys.com',
      accessKeyId: process.env.WASABI_ACCESS_KEY,
      secretAccessKey: process.env.WASABI_SECRET_KEY,
      region: 'eu-west-1',
    });
  }

  async generatePutSignedUrlForUpload(
    bucketName: string,
    key: string,
    contentType: string,
    ExpiresTime: number = 3600,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.s3.getSignedUrl(
        'putObject',
        {
          Bucket: bucketName,
          Key: key,
          ContentType: contentType,
          ...(bucketName === process.env.PUBLIC_BUCKET && {
            ACL: 'public-read',
          }),
          ...(bucketName !== process.env.PUBLIC_BUCKET && {
            ACL: 'bucket-owner-full-control',
          }),
          // ACL: 'bucket-owner-full-control',
          Expires: ExpiresTime,
        },
        (err, url) => {
          if (err) {
            reject(err);
          }
          resolve(url);
        },
      );
    });
  }

  async generateGetFileSignedUrl(
    bucketName: string,
    key: string,
  ): Promise<string> {
    //generate a presigned url for get file
    const result = await this.s3.getSignedUrlPromise('getObject', {
      Bucket: bucketName,
      Key: key,
      // Expires: 3600,
    });
    return result;
  }

  async uploadFileToBucket(
    fileBody: Buffer,
    contentType: string,
    bucketName: string,
    key: string,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.s3.putObject(
        {
          // Body: readFileSync('public/images/service.png'),
          Body: fileBody,
          ContentType: contentType,
          ...(bucketName === process.env.PUBLIC_BUCKET && {
            ACL: 'public-read',
          }),
          ...(bucketName !== process.env.PUBLIC_BUCKET && {
            ACL: 'bucket-owner-full-control',
          }),
          Bucket: bucketName,
          Key: key,
        },
        (err, data) => {
          if (err) {
            reject(false);
          }
          resolve(true);
        },
      );
    });
  }

  async checkObjectExistInBucket(
    bucket: string,
    objectKey: string,
    validContentTypes: string[] = [
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'application/pdf',
    ],
  ): Promise<boolean> {
    try {
      const result = await this.s3
        .headObject({
          Bucket: bucket,
          Key: objectKey,
        })
        .promise();
      if (validContentTypes.includes(result.ContentType)) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async copyObject(
    source: string,
    destinationBucket: string,
    destinationKey: string,
  ) {
    // -------this is a how we can copy an object to another bucket.
    return await this.s3
      .copyObject({
        Bucket: destinationBucket,
        Key: destinationKey,
        ...(destinationBucket === process.env.PUBLIC_BUCKET && {
          ACL: 'public-read',
        }),
        ...(destinationBucket !== process.env.PUBLIC_BUCKET && {
          ACL: 'bucket-owner-full-control',
        }),
        CopySource: encodeURI(source),
      })
      .promise();
  }

  async moveObject(
    sourceKey: string,
    sourceBucket: string,
    destinationBucket: string,
    destinationKey: string,
  ) {
    await this.s3
      .copyObject({
        Bucket: destinationBucket,
        Key: destinationKey,
        ...(destinationBucket === process.env.PUBLIC_BUCKET && {
          ACL: 'public-read',
        }),
        ...(destinationBucket !== process.env.PUBLIC_BUCKET && {
          ACL: 'bucket-owner-full-control',
        }),
        CopySource: encodeURI(`${sourceBucket}/${sourceKey}`),
      })
      .promise();

    await this.s3
      .deleteObject({
        Bucket: sourceBucket,
        Key: sourceKey,
      })
      .promise();

    return true;
  }

  async deleteObject(bucket: string, key: string) {
    await this.s3
      .deleteObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
    return true;
  }

  async getAllObjectsInBucket(
    bucket: string,
    prefix: string,
    continuationToken?: string,
    startAfter?: string,
  ) {
    return await this.s3
      .listObjectsV2({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: prefix,
        MaxKeys: 1000,
        ...(continuationToken && { ContinuationToken: continuationToken }),
        ...(startAfter && { StartAfter: startAfter }),
        // ContinuationToken:"62adaceaa85c11ba680a70e3/e80b3196-cf81-400f-aaf8-307513efcbb2.jpeg",
      })
      .promise();
  }
}
