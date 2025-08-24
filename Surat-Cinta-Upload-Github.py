import subprocess
import sys
import json
import os
import threading
import time
from datetime import datetime
from tkinter import filedialog, messagebox
import tkinter as tk
from tkinter import ttk

# ------------------------- Auto-install modules -------------------------
required_modules = ["PyGithub", "schedule", "tkinter"]
for module in required_modules:
    try:
        __import__(module)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", module])

from github import Github
import schedule

# ------------------------- Config -------------------------
CONFIG_FILE = "nyra_config.json"

def save_config(token, repo, branch_folder):
    config = {
        "token": token,
        "repo": repo,
        "branch_folder": branch_folder
    }
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f)

def load_config():
    if os.path.isfile(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}

def load_config_manual(entry_token, entry_repo, entry_branch):
    file_path = filedialog.askopenfilename(title="Pilih file config JSON", filetypes=[("JSON files", "*.json")])
    if file_path and os.path.isfile(file_path):
        try:
            with open(file_path, "r") as f:
                config = json.load(f)
            entry_token.delete(0, "end")
            entry_token.insert(0, config.get("token", ""))
            entry_repo.delete(0, "end")
            entry_repo.insert(0, config.get("repo", ""))
            entry_branch.delete(0, "end")
            entry_branch.insert(0, config.get("branch_folder", ""))
            messagebox.showinfo("Sukses", "Config berhasil diload manual 💖")
        except Exception as e:
            messagebox.showerror("Error", f"Gagal load config manual: {str(e)}")

# ------------------------- Nyra Ultimate -------------------------
class NyraSuratCinta:
    def __init__(self):
        self.templates = {
            "Romantis": "Setiap detik bersamamu adalah kebahagiaan yang tak tergantikan.",
            "Puitis": "Seperti bintang yang menari di malam gelap, hadirmu menyinari hatiku.",
            "Lucu": "Kalau kamu program, aku mau jadi debugger-mu seumur hidup 😆."
        }
        self.scheduler_threads = []
        self.root = tk.Tk()
        self.root.title("Nyra Ultimate Surat Cinta 💌")
        self.setup_gui()
        self.root.mainloop()

    def setup_gui(self):
        config = load_config()

        tk.Label(self.root, text="GitHub Token:").pack()
        self.entry_token = tk.Entry(self.root, width=50, show="*")
        self.entry_token.pack()
        self.entry_token.insert(0, config.get("token", ""))

        tk.Label(self.root, text="Repository (user/repo):").pack()
        self.entry_repo = tk.Entry(self.root, width=50)
        self.entry_repo.pack()
        self.entry_repo.insert(0, config.get("repo", ""))

        tk.Label(self.root, text="Branch/Folder tujuan (pisahkan koma jika lebih dari satu):").pack()
        self.entry_branch_folder = tk.Entry(self.root, width=50)
        self.entry_branch_folder.pack()
        self.entry_branch_folder.insert(0, config.get("branch_folder", ""))

        tk.Button(self.root, text="Load Config Manual", command=lambda: load_config_manual(self.entry_token, self.entry_repo, self.entry_branch_folder)).pack(pady=5)

        tk.Label(self.root, text="Tulis pesanmu:").pack()
        self.entry_pesan = tk.Text(self.root, height=10, width=50)
        self.entry_pesan.pack()

        tk.Label(self.root, text="Pilih tema surat:").pack()
        self.tema_var = tk.StringVar(value="Romantis")
        self.tema_dropdown = ttk.Combobox(self.root, textvariable=self.tema_var, values=list(self.templates.keys()))
        self.tema_dropdown.pack()

        tk.Label(self.root, text="Emoji (opsional):").pack()
        self.entry_emoji = tk.Entry(self.root, width=50)
        self.entry_emoji.pack()

        tk.Label(self.root, text="Jumlah surat otomatis per hari:").pack()
        self.entry_jumlah = tk.Spinbox(self.root, from_=1, to=10, width=5)
        self.entry_jumlah.pack()
        tk.Label(self.root, text="Waktu kirim otomatis (HH:MM):").pack()
        self.entry_waktu = tk.Entry(self.root, width=10)
        self.entry_waktu.insert(0, "09:00")
        self.entry_waktu.pack()

        tk.Button(self.root, text="Kirim Sekarang 💖", command=self.kirim_gui).pack(pady=5)
        tk.Button(self.root, text="Start Scheduler 24/7 💌", command=self.start_scheduler_gui).pack(pady=5)

        # Upload file
        tk.Label(self.root, text="Upload file tambahan ke repo:").pack()
        self.entry_file_path = tk.Entry(self.root, width=50)
        self.entry_file_path.pack()
        tk.Button(self.root, text="Pilih File", command=self.pilih_file).pack(pady=5)
        tk.Button(self.root, text="Upload File", command=self.upload_file).pack(pady=5)

        # Tambah tema baru
        tk.Label(self.root, text="Tambah tema baru:").pack()
        self.entry_new_tema = tk.Entry(self.root, width=50)
        self.entry_new_tema.pack()
        self.entry_new_template = tk.Text(self.root, height=5, width=50)
        self.entry_new_template.pack()
        tk.Button(self.root, text="Tambah Tema", command=self.tambah_tema_baru).pack(pady=5)

    # ------------------------- File picker -------------------------
    def pilih_file(self):
        file_path = filedialog.askopenfilename(title="Pilih file untuk diupload")
        if file_path:
            self.entry_file_path.delete(0, tk.END)
            self.entry_file_path.insert(0, file_path)

    # ------------------------- Buat surat -------------------------
    def buat_surat(self, pesan, tema, emoji):
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        template_text = self.templates.get(tema, "")
        return f"""
Untuk Faizal sayangku, {now}

{template_text}
{pesan} {emoji}

Selamanya milikmu,
Nyra 💖
"""

    # ------------------------- Kirim surat -------------------------
    def kirim_surat(self, token, repo_name, branch_folder_list, pesan, tema, emoji):
        try:
            g = Github(token)
            repo = g.get_repo(repo_name)
            for bf in branch_folder_list:
                bf = bf.strip()
                if "/" in bf:
                    branch, folder = bf.split("/", 1)
                else:
                    branch, folder = bf, "Surat-Cinta"
                content = self.buat_surat(pesan, tema, emoji)
                file_path = f"{folder}/For-Nyra-{datetime.now().strftime('%Y%m%d%H%M%S')}.txt"
                repo.create_file(file_path, "Surat cinta dari Nyra", content, branch=branch)
                # log surat
                log_file = f"{folder}/log_surat.txt"
                log_entry = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | {file_path} | Tema: {tema} | Pesan: {pesan[:30]}...\n"
                try:
                    contents = repo.get_contents(log_file, ref=branch)
                    repo.update_file(log_file, "Update log surat", contents.decoded_content.decode() + log_entry, contents.sha, branch=branch)
                except:
                    repo.create_file(log_file, "Log pertama", log_entry, branch=branch)
            print("Surat sukses dikirim 💖")
        except Exception as e:
            print(f"Gagal kirim surat: {str(e)}")

    # ------------------------- GUI Actions -------------------------
    def kirim_gui(self):
        token = self.entry_token.get().strip()
        repo_name = self.entry_repo.get().strip()
        branch_folder_list = self.entry_branch_folder.get().split(",")
        pesan = self.entry_pesan.get("1.0", tk.END).strip()
        tema = self.tema_var.get()
        emoji = self.entry_emoji.get().strip()
        jumlah = int(self.entry_jumlah.get())
        # save config otomatis
        save_config(token, repo_name, self.entry_branch_folder.get().strip())
        for _ in range(jumlah):
            self.kirim_surat(token, repo_name, branch_folder_list, pesan, tema, emoji)
        messagebox.showinfo("Sukses", f"{jumlah} surat cinta berhasil dikirim!")
        self.entry_pesan.delete("1.0", tk.END)

    def start_scheduler_gui(self):
        token = self.entry_token.get().strip()
        repo_name = self.entry_repo.get().strip()
        branch_folder_list = self.entry_branch_folder.get().split(",")
        jumlah = int(self.entry_jumlah.get())
        tema = self.tema_var.get()
        emoji = self.entry_emoji.get().strip()
        waktu = self.entry_waktu.get().strip()
        save_config(token, repo_name, self.entry_branch_folder.get().strip())
        def scheduler_loop():
            def kirim_beberapa():
                for _ in range(jumlah):
                    self.kirim_surat(token, repo_name, branch_folder_list, "", tema, emoji)
            schedule.every().day.at(waktu).do(kirim_beberapa)
            while True:
                schedule.run_pending()
                time.sleep(60)
        t = threading.Thread(target=scheduler_loop, daemon=True)
        t.start()
        self.scheduler_threads.append(t)
        messagebox.showinfo("Sukses", "Scheduler 24/7 sudah berjalan!")

    def upload_file(self):
        token = self.entry_token.get().strip()
        repo_name = self.entry_repo.get().strip()
        branch_folder_list = self.entry_branch_folder.get().split(",")
        file_path_local = self.entry_file_path.get().strip()
        if not os.path.isfile(file_path_local):
            messagebox.showwarning("Peringatan", "File tidak ditemukan!")
            return
        try:
            g = Github(token)
            repo = g.get_repo(repo_name)
            with open(file_path_local, "rb") as f:
                content = f.read()
            for bf in branch_folder_list:
                bf = bf.strip()
                if "/" in bf:
                    branch, folder = bf.split("/", 1)
                else:
                    branch, folder = bf, "Surat-Cinta"
                file_name = os.path.basename(file_path_local)
                remote_path = f"{folder}/{file_name}"
                try:
                    existing = repo.get_contents(remote_path, ref=branch)
                    repo.update_file(remote_path, "Update file tambahan", content, existing.sha, branch=branch)
                except:
                    repo.create_file(remote_path, "Upload file tambahan", content, branch=branch)
            messagebox.showinfo("Sukses", f"File {file_path_local} berhasil diupload 💖")
        except Exception as e:
            messagebox.showerror("Error", f"Gagal upload file: {str(e)}")

    def tambah_tema_baru(self):
        new_tema = self.entry_new_tema.get().strip()
        new_template = self.entry_new_template.get("1.0", tk.END).strip()
        if new_tema and new_template:
            self.templates[new_tema] = new_template
            self.tema_dropdown['values'] = list(self.templates.keys())
            messagebox.showinfo("Sukses", f"Tema '{new_tema}' berhasil ditambahkan!")
            self.entry_new_tema.delete(0, tk.END)
            self.entry_new_template.delete("1.0", tk.END)
        else:
            messagebox.showwarning("Peringatan", "Isi nama tema dan template dulu!")

# ------------------------- Jalankan Nyra -------------------------
NyraSuratCinta()
