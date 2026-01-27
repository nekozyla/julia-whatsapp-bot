import os
import json

def generate_meme_index():
    # Pasta onde os áudios foram baixados (ajuste se mudou o nome)
    audio_dir = "audio"
    output_file = "memes_index.json"
    
    if not os.path.exists(audio_dir):
        print(f"Erro: A pasta {audio_dir} não foi encontrada.")
        return

    meme_list = []
    
    print(f"Lendo arquivos de {audio_dir}...")

    # Extensões que queremos indexar
    valid_extensions = ('.mp3', '.opus', '.ogg')

    # Listar todos os arquivos na pasta
    files = os.listdir(audio_dir)
    
    for filename in files:
        if filename.endswith(valid_extensions):
            # Remove a extensão para criar o "nome amigável"
            name_only = os.path.splitext(filename)[0]
            
            # Cria um objeto para cada meme
            meme_data = {
                "name": name_only.replace("_", " ").title(), # Nome formatado
                "command": name_only.lower(),               # Comando para o bot
                "file": filename,                            # Nome real do arquivo
                "path": os.path.join(audio_dir, filename)    # Caminho completo
            }
            meme_list.append(meme_data)

    # Salva tudo em um arquivo JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(meme_list, f, indent=4, ensure_ascii=False)

    print(f"--- Sucesso! ---")
    print(f"Total de memes indexados: {len(meme_list)}")
    print(f"Arquivo gerado: {output_file}")

if __name__ == "__main__":
    generate_meme_index()
