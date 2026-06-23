import sys
from rembg import remove
from PIL import Image
import io

def remove_background(input_path, output_path):
    try:
        with open(input_path, 'rb') as i:
            input_data = i.read()
            output_data = remove(input_data)
        
        with open(output_path, 'wb') as o:
            o.write(output_data)
        
        print(f"Background removed successfully. Output saved to {output_path}")
    except Exception as e:
        print(f"Error removing background: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_bg.py <input_path> <output_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    remove_background(input_path, output_path)
