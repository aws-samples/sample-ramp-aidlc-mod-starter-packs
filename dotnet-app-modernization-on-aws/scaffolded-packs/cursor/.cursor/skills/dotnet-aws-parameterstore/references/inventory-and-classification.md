# Inventory and Classification Guide

How to audit a .NET application's configuration and classify values for externalization.

## Step 1: Scan Configuration Sources

### appsettings.json

Read `appsettings.json` and any environment variants (`appsettings.Production.json`, etc.). List every key-value pair.

### Hardcoded strings

Search for:
- Connection strings in `DbContext` registration, `AddDbContext`, or `UseSqlServer()` calls
- URLs in `HttpClient` configuration (`BaseAddress`, `AddHttpClient`)
- Keys in attribute values or constants
- `Environment.GetEnvironmentVariable()` calls for config values

### Existing externalization

Check if the app already has an SSM helper class or uses `AddSystemsManager()`. If partial externalization exists, identify what's left to migrate.

## Step 2: Classify Each Value

| Classification | Default Store | Trigger Criteria |
|---------------|--------------|-----------------|
| Credential / Secret | **Secrets Manager** | Contains `Password=`, `Pwd=`, `User Id=`, API secret key, OAuth client secret, encryption key, bearer token |
| Environment-specific, non-sensitive | **SSM Parameter Store (String)** | API URLs, S3 bucket names, EventBridge bus names, queue/topic names, account IDs, feature flags, resource ARNs |
| Static / shared | **Keep in appsettings.json** | `Logging` config, `AllowedHosts`, `ServiceName`, retry counts, display names, `MaxFileMB` |

## Step 3: Propose Naming Convention

Use this path format:

```
/app/<service-name>/<category>/<key>
```

Rules:
- All lowercase
- No trailing slashes
- Use `/` as path separator
- Keep paths short and descriptive

### Examples

| Config Key | SSM Parameter Path |
|-----------|-------------------|
| DB connection string | `/app/origination/db/connectionstring` |
| S3 bucket name | `/app/origination/s3/bucketname` |
| S3 upload folder | `/app/origination/s3/uploadfolder` |
| EventBridge bus name | `/app/origination/eventbridge/busname` |
| API Gateway invoke URL | `/app/origination/api/invokeurl` |
| API resource path | `/app/origination/api/paths/application` |
| Partner API base URL | `/app/origination/api/partner/baseurl` |

## Step 4: Present to Developer for Confirmation

Show the inventory as a table and ask:

> "I've classified the configuration values below. By default, any value containing credentials (username/password) will be stored in **Secrets Manager**, and everything else goes to **SSM Parameter Store** as String type.
>
> Would you like to override any of these? For example, if you prefer to use **Parameter Store SecureString** instead of Secrets Manager for credentials, let me know."

### Example Inventory Table

| Config Key | Current Value (redacted) | Proposed SSM Path | Store |
|-----------|-------------------------|-------------------|-------|
| `ConnectionStrings:Default` | `Server=...;Password=***` | `/app/myservice/db/connectionstring` | Secrets Manager |
| `AWS:S3:BucketName` | `my-bucket` | `/app/myservice/s3/bucketname` | SSM (String) |
| `AWS:EventBridge:EventbusName` | `my-events` | `/app/myservice/eventbridge/busname` | SSM (String) |
| `ExternalApi:BaseUrl` | `https://api.example.com` | `/app/myservice/api/partner/baseurl` | SSM (String) |
| `Logging:LogLevel:Default` | `Debug` | — | Keep in appsettings.json |
| `ServiceName` | `MyService` | — | Keep in appsettings.json |

### Additional Questions

- **Service name** — used as path prefix (e.g., `origination`, `applysample`)
- **Environments** — which environments to support (default: `dev`, `prod`)
- **Exceptions** — any values the developer wants to keep in appsettings.json despite being environment-specific

## If User Overrides Secrets Manager → SecureString

When the user chooses SSM Parameter Store SecureString instead of Secrets Manager for credentials:
- The parameter path stays the same
- The helper class uses `WithDecryption = true` (already handles SecureString transparently)
- The CLI creation command uses `--type SecureString` instead of `aws secretsmanager create-secret`
- The IAM policy needs `kms:Decrypt` in addition to `ssm:GetParameter`
