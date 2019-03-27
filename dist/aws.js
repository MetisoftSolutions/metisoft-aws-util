"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const aws = __importStar(require("aws-sdk"));
function initAws(app, options) {
    aws.config.loadFromPath(options.pathToAwsConfig);
    const s3 = new aws.S3({
        apiVersion: '2006-03-01',
        params: {
            Bucket: options.s3.bucketName
        }
    });
    return {
        s3
    };
}
exports.initAws = initAws;
//# sourceMappingURL=aws.js.map