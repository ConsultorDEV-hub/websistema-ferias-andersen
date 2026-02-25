from flask import Flask, render_template, request, jsonify
import sqlite3
import os
import threading
import time

app = Flask(__name__)

# AJUSTE DE CAMINHO: O banco agora vive em /app/data para persistência no Docker
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "database.db")

# Garante que a pasta 'data' exista para não dar erro de escrita
if not os.path.exists(os.path.join(BASE_DIR, "data")):
    os.makedirs(os.path.join(BASE_DIR, "data"))

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS colaboradores 
                    (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, dias_direito INTEGER, saldo INTEGER)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS ferias 
                    (id INTEGER PRIMARY KEY AUTOINCREMENT, colab_id INTEGER, nome TEXT, inicio TEXT, fim TEXT, 
                    FOREIGN KEY(colab_id) REFERENCES colaboradores(id))''')
    conn.commit()
    conn.close()

init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index(): return render_template('index.html')

@app.route('/cadastrar', methods=['POST'])
def cadastrar():
    data = request.json
    conn = get_db_connection()
    conn.execute('INSERT INTO colaboradores (nome, dias_direito, saldo) VALUES (?, ?, ?)', 
                 (data.get('nome'), data.get('dias'), data.get('dias')))
    conn.commit()
    conn.close()
    return jsonify({"status": "sucesso"})

@app.route('/registrar_ferias', methods=['POST'])
def registrar_ferias():
    data = request.json
    conn = get_db_connection()
    conn.execute('UPDATE colaboradores SET saldo = saldo - ? WHERE id = ?', (data.get('dias_calc'), data.get('id')))
    conn.execute('INSERT INTO ferias (colab_id, nome, inicio, fim) VALUES (?, ?, ?, ?)',
                 (data.get('id'), data.get('nome'), data.get('inicio'), data.get('fim')))
    conn.commit()
    conn.close()
    return jsonify({"status": "sucesso"})

@app.route('/deletar_registro_ferias', methods=['POST'])
def deletar_registro():
    data = request.json
    conn = get_db_connection()
    conn.execute('UPDATE colaboradores SET saldo = saldo + ? WHERE id = ?', (data.get('dias'), data.get('id_colab')))
    conn.execute('DELETE FROM ferias WHERE id = ?', (data.get('id_ferias'),))
    conn.commit()
    conn.close()
    return jsonify({"status": "sucesso"})

@app.route('/listar_colaboradores', methods=['GET'])
def listar_colabs():
    conn = get_db_connection()
    colabs = conn.execute('SELECT * FROM colaboradores').fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in colabs])

@app.route('/listar_ferias', methods=['GET'])
def listar_ferias():
    conn = get_db_connection()
    ferias = conn.execute('SELECT * FROM ferias').fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in ferias])

@app.route('/deletar/<int:id>', methods=['DELETE'])
def deletar(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM colaboradores WHERE id = ?', (id,))
    conn.execute('DELETE FROM ferias WHERE colab_id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "sucesso"})

# SCRIPT ANTI-SONO: Mantém a atividade mínima para nuvens como a Oracle
def manter_vivo():
    while True:
        _ = 1 + 1
        time.sleep(300)

threading.Thread(target=manter_vivo, daemon=True).start()

# ALTERAÇÃO PARA DOCKER: host '0.0.0.0' permite acesso externo ao container
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)