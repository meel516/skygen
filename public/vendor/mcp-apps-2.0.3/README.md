# MCP Apps browser runtime

`app.js` is the unmodified `dist/src/app-with-deps.js` from the official
`@modelcontextprotocol/ext-apps@2.0.3` npm package. It includes its dependencies
and has no external module imports. The package license is included here.

Package integrity:
`sha512-Tn+4+cyhO4f4cQSDxNyLiIfEE+qlTTuIbWBJB8JTinEXOhDYgCT4wDTQplxD9MBYZH5pCYGC59GaxiwIT4bu8w==`

Keep the versioned asset path immutable. To update, download an exact package
version with `npm pack`, verify its integrity, copy its `app-with-deps.js` and
license into a new version directory, and test the host handshake before
updating the resource imports. Do not use a CDN-transformed module here.
