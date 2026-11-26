# GitHub Gist MCP Server

This server provides tools for creating and managing GitHub Gists. It is handy for sharing code snippets and files.

## Main features

### Gist management
- **Create a Gist**: Create a Gist with a single file or multiple files
- **Get a Gist**: Show the details of the Gist with the given ID
- **Update a Gist**: Change the description or files of an existing Gist
- **Delete a Gist**: Permanently delete the given Gist
- **List Gists**: Show a user's Gists (your own or another user's)

### Visibility
- **Private Gist**: Created as private by default
- **Public Gist**: Created as public only when explicitly specified

### Image upload
- Upload Base64-encoded images to a Gist
- Automatically created as a private Gist

### Stars
- Star / unstar a Gist
- Check the star status

## Examples

### Creating a basic Gist
```
Please save this simple Python script to a Gist:

def hello_world():
    print("Hello, World!")

if __name__ == "__main__":
    hello_world()
```

### Creating a Gist with multiple files
```
Please put the project's config files together into a Gist:
- package.json
- tsconfig.json
- .gitignore
```

### Gist with an image
```
Please save this image as a private Gist
[Base64 data]
```

## Required environment settings

A GitHub Personal Access Token is required. Set a token with the following scope in the `GITHUB_TOKEN` environment variable:

- `gist` - Create, read/write, and delete Gists

## Security

- All Gists are created as private by default
- Public Gists are created only when explicitly specified
- The API token is obtained safely from environment variables