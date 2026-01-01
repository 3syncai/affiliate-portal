# AWS S3 Configuration for Affiliate Portal

## Required Environment Variables

Add these variables to your `.env` file in the affiliate-portal directory:

```env
# AWS S3 Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_S3_BUCKET_NAME=your_bucket_name_here
```

## Setup Instructions

1. **Create an AWS S3 Bucket** (if not already created)
   - Go to AWS S3 Console
   - Create a new bucket
   - Note the bucket name

2. **Create IAM User** (if not already created)
   - Go to AWS IAM Console
   - Create a new user with programmatic access
   - Attach policy: `AmazonS3FullAccess` (or create custom policy)
   - Save the Access Key ID and Secret Access Key

3. **Configure Bucket Permissions**
   - Enable public read access for uploaded files (optional)
   - Configure CORS if needed for direct browser uploads

4. **Update .env File**
   - Copy the values above into your `.env` file
   - Replace placeholder values with actual AWS credentials

## File Upload Structure

Files are uploaded to S3 in the following structure:
```
s3://your-bucket-name/
  └── affiliate/
      └── username/
          ├── aadhar.jpg   (or .png, .jpeg)
          └── pancard.jpg  (or .png, .jpeg)
```

## Example
For user with email `vishal@gmail.com`:
- Upload folder: `affiliate/vishal/`
- Aadhar card: `affiliate/vishal/aadhar.jpg`
- PAN card: `affiliate/vishal/pancard.jpg`

## Notes
- Files are automatically renamed based on document type
- Username is extracted from email (before @ symbol)
- File extensions are preserved from original upload
