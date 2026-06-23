import requests
from bs4 import BeautifulSoup
import re
import sys
import json
import unicodedata

def obter_letra_musica(artista, musica):
    """
    Faz o web scraping da letra de uma música no site letras.mus.br
    """
    # Remove o caractere "å" antes de fazer a busca (caso venha do nome da música/artista)
    artista = artista.replace('å', '').replace('Å', '')
    musica = musica.replace('å', '').replace('Å', '')

    # Normaliza outros acentos (transforma "é" em "e", "ç" em "c", etc)
    artista = unicodedata.normalize('NFKD', artista).encode('ASCII', 'ignore').decode('utf-8')
    musica = unicodedata.normalize('NFKD', musica).encode('ASCII', 'ignore').decode('utf-8')

    artista_url = re.sub(r'[^a-zA-Z0-9]', '-', artista.lower().strip())
    musica_url = re.sub(r'[^a-zA-Z0-9]', '-', musica.lower().strip())
    
    artista_url = re.sub(r'-+', '-', artista_url)
    musica_url = re.sub(r'-+', '-', musica_url)
    
    url = f"https://www.letras.mus.br/{artista_url}/{musica_url}/"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    
    try:
        resposta = requests.get(url, headers=headers)
        
        if resposta.status_code != 200:
            return {"error": f"Não foi possível encontrar a música. Status code: {resposta.status_code}"}
            
        soup = BeautifulSoup(resposta.text, 'html.parser')
        
        div_letra = soup.find('div', class_='lyric-original') or soup.find('div', class_='lyric')
        
        # Extrai título e artista da página para verificação
        found_track = ""
        found_artist = ""
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            og_content = og_title['content']
            # Formato típico: "Nome da Música - Artista"
            if ' - ' in og_content:
                parts = og_content.split(' - ', 1)
                found_track = parts[0].strip()
                found_artist = parts[1].strip()
            else:
                found_track = og_content.strip()
        else:
            title_tag = soup.find('title')
            if title_tag:
                title_text = title_tag.get_text()
                if ' - ' in title_text:
                    parts = title_text.split(' - ', 1)
                    found_track = parts[0].strip()
                    found_artist = parts[1].split('|')[0].strip()

        if div_letra:
            for br in div_letra.find_all("br"):
                br.replace_with("\n")
                
            for elem in div_letra.find_all(['script', 'style']):
                elem.extract()
                
            # Extrai o texto garantindo que haja quebra de linha entre tags diferentes (como <p>)
            letra_limpa = div_letra.get_text(separator="\n").strip()
            
            # Remove quebras de linha triplas ou maiores geradas pela junção de parágrafos
            letra_limpa = re.sub(r'\n{3,}', '\n\n', letra_limpa)
            
            return {"lyrics": letra_limpa, "found_track": found_track, "found_artist": found_artist}
        else:
            return {"error": "Página encontrada, mas a estrutura da letra não foi localizada."}
            
    except requests.exceptions.RequestException as e:
        return {"error": f"Erro de conexão ao acessar o site: {e}"}

# --- Execução do Script ---
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Argumentos insuficientes. Uso: python3 scrapper.py <artista> <musica>"}))
        sys.exit(1)
        
    nome_artista = sys.argv[1]
    nome_musica = sys.argv[2]
    
    resultado = obter_letra_musica(nome_artista, nome_musica)
    print(json.dumps(resultado))