# Imagem para compilar o helper para Windows a partir do Linux (scripts/build-win.sh).
FROM rust:1-bookworm
RUN apt-get -qq update && apt-get -qq install -y gcc-mingw-w64-x86-64 >/dev/null && rustup target add x86_64-pc-windows-gnu
