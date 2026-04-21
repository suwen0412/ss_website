# Tool 3 local encoder

1. Open a terminal in this folder.
2. Install Pillow:
   ```bash
   pip install -r requirements_tool3_local_encoder.txt
   ```
3. Start the helper:
   ```bash
   python tool3_local_encoder.py
   ```
4. In Tool 3, switch **Encoder mode** to **Local terminal helper**.
5. Generate the GIF normally.

If `ffmpeg` is installed and on your PATH, the helper uses it automatically for faster GIF assembly. Otherwise it falls back to Pillow.
