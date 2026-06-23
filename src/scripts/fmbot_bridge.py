import sys
import json
import requests

LASTFM_API_KEY = "3a0fa888147d3c01bf28038ae1cff97f" # Fake key for compiling, will read from config or args if needed. But for now let's just use what's passed or a placeholder. 
# actually let's take it as an argument to avoid hardcoding.

def get_top_artists(api_key, username, limit=10):
    url = f"https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user={username}&api_key={api_key}&format=json&limit={limit}"
    
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if 'error' in data:
            return {"error": data.get('message', 'Last.fm API Error')}
            
        artists = data.get('topartists', {}).get('artist', [])
        result = [f"{i+1}. {a['name']} ({a['playcount']} plays)" for i, a in enumerate(artists)]
        
        return {
            "success": True, 
            "message": f"🏆 Top Artists for {username}:\n" + "\n".join(result)
        }
    except Exception as e:
        return {"error": str(e)}

def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Missing arguments. Usage: fmbot_bridge.py <api_key> <command> <username>"}))
        return

    api_key = sys.argv[1]
    command = sys.argv[2].lower()
    username = sys.argv[3]

    if command == "topartists":
        result = get_top_artists(api_key, username)
    else:
        result = {"error": f"Unknown command: {command}"}

    print(json.dumps(result))

if __name__ == "__main__":
    main()
