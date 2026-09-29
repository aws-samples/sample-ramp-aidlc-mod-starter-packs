# Phase 2 — Wire Dependency Injection

The transform produces Program.cs with placeholder comments (`//Added Services`) but incomplete registrations. Complete the DI wiring.

## Pre-requisite

If ATX artifacts were found in Phase 0, use them to identify the full list of interfaces and implementations. The Modernization Plan and nextsteps.md often explicitly list all services that need registration.

## Steps

### 1. Scan for Interface-to-Implementation Pairs
Search all projects for:
- Domain services (e.g., `IBookService` → `BookService`)
- Repositories (e.g., `IBookRepository` → `BookRepository`)
- Infrastructure services (e.g., `IFileService` → `LocalFileService` / `S3FileService`)
- Image services (e.g., `IImageValidationService`, `IImageResizeService`)

### 2. Register Services
Use `builder.Services` in Program.cs:
```csharp
// Domain services
builder.Services.AddTransient<IBookService, BookService>();
builder.Services.AddTransient<ICustomerService, CustomerService>();
builder.Services.AddTransient<IShoppingCartService, ShoppingCartService>();
builder.Services.AddTransient<IAddressService, AddressService>();
builder.Services.AddTransient<IOrderService, OrderService>();
builder.Services.AddTransient<IReferenceDataService, ReferenceDataService>();

// Repositories
builder.Services.AddTransient<IBookRepository, BookRepository>();
builder.Services.AddTransient<ICustomerRepository, CustomerRepository>();
builder.Services.AddTransient<IShoppingCartRepository, ShoppingCartRepository>();
builder.Services.AddTransient<IAddressRepository, AddressRepository>();
builder.Services.AddTransient<IOrderRepository, OrderRepository>();
builder.Services.AddTransient<IReferenceDataRepository, ReferenceDataRepository>();

// Infrastructure
builder.Services.AddTransient<IImageResizeService, ImageResizeService>();
builder.Services.TryAddSingleton<IHttpContextAccessor, HttpContextAccessor>();
```

### 3. Handle Conditional Services
For services that switch between local/AWS based on configuration in appsettings.json `Services` section:

```csharp
// File service — local or S3
if (builder.Configuration["Services:FileService"] == "aws")
{
    builder.Services.AddTransient<IAmazonS3, AmazonS3Client>();
    builder.Services.AddTransient<IFileService, S3FileService>();
}
else
{
    builder.Services.AddTransient<IFileService, LocalFileService>(sp =>
        new LocalFileService(builder.Environment.WebRootPath));
}

// Image validation — local or Rekognition
if (builder.Configuration["Services:ImageValidationService"] == "aws")
{
    builder.Services.AddTransient<IAmazonRekognition, AmazonRekognitionClient>();
    builder.Services.AddTransient<IImageValidationService, RekognitionImageValidationService>();
}
else
{
    builder.Services.AddTransient<IImageValidationService, LocalImageValidationService>();
}
```

### 4. Register DbContext
```csharp
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
```

Use whatever connection string name is in appsettings.json.

### 5. Register Database Seeder (Hosted Service)

If the transform produced a `BookstoreDbInitializer` or similar class that implements `IHostedService` (replacing the EF6 `DropCreateDatabaseIfModelChanges` initializer), register it:

```csharp
builder.Services.AddHostedService<BookstoreDbInitializer>();
```

**Common miss**: The transform creates the seeder class but does NOT register it in Program.cs. Without this registration, the database will never be created or seeded, leading to empty pages or SQL errors.

### 6. Fix BookstoreConfiguration / ConfigurationManager Shim

The transform often creates a `BookstoreConfiguration` shim that loads settings from `IConfiguration`. Legacy code calls `BookstoreConfiguration.GetSetting("Services/Authentication")` using `/` as a path separator, but ASP.NET Core uses `:` for nested config keys.

**Ensure the shim translates path separators**:

```csharp
public static string GetSetting(string key)
{
    // Check pre-loaded dictionary first
    if (_appSettings.TryGetValue(key, out var value))
        return value;

    // Fall back to IConfiguration using ":" separator
    var configKey = key.Replace("/", ":");
    return _configuration[configKey];
}
```

**Also ensure it stores the full `IConfiguration` reference** so it can look up nested keys that weren't pre-loaded into the flat dictionary:

```csharp
private readonly IConfiguration _configuration;

private BookstoreConfiguration(IConfiguration configuration)
{
    _configuration = configuration;
    // ... existing dictionary loading ...
}
```

Without this fix, any call to `GetSetting("Services/Authentication")` or `GetSetting("Authentication/Cognito/CognitoDomain")` will throw a `KeyNotFoundException` or return null at runtime.

### 7. Verify Completeness
For every controller in the project:
1. Read the constructor parameters
2. Confirm each injected interface has a registration
3. Add any missing registrations

## Key Principle
Use the built-in Microsoft DI container (`IServiceCollection`), NOT Autofac, unless Autofac is explicitly required by the project architecture. If the transform preserved Autofac (`UseServiceProviderFactory<ContainerBuilder>`), work with it rather than ripping it out.

## Phase Gate
✅ Every controller's constructor dependencies are resolvable via registered services.
✅ Database seeder hosted service is registered (if applicable).
✅ BookstoreConfiguration shim handles `/` → `:` path translation.
✅ `dotnet build` still passes after changes.
