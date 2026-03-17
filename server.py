import http.server
import socketserver
import os

# 設定預設連線埠，可以修改成任何想要的 Port
PORT = 8000

# 確保伺服器的根目錄在此腳本的位置，避免相對路徑錯誤
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 建立預設的請求處理器，這會自動尋找 index.html
class Handler(http.server.SimpleHTTPRequestHandler):
    pass

# 啟動並維持伺服器運行
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"✅ 開發測試伺服器已啟動： http://localhost:{PORT}")
    print("💡 按下 Ctrl+C 可停止伺服器。")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 伺服器已手動關閉。")
