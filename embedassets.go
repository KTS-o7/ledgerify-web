package ledgerify

import "embed"

//go:embed all:frontend/dist
var staticFiles embed.FS

func StaticFS() embed.FS {
	return staticFiles
}
