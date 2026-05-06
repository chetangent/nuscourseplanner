from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os


def main() -> None:
    root = Path(__file__).resolve().parent
    os.chdir(root)

    port = int(os.environ.get("PORT", "4173"))
    host = os.environ.get("HOST", "127.0.0.1")

    server = ThreadingHTTPServer((host, port), SimpleHTTPRequestHandler)
    print(f"NUS Course Planner running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
