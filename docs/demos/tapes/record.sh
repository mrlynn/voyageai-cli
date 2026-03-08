for tape in *.tape; do vhs "$tape"; done
python3 watermark-demos.py ./ --style robot --opacity 0.20