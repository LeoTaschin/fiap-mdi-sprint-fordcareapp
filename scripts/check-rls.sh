#!/usr/bin/env bash
# Policy-as-code: toda tabela criada nas migrations precisa de
# "ENABLE ROW LEVEL SECURITY" e de pelo menos uma CREATE POLICY.
# Sem isso, a anon key (pública, embarcada no APK) leria a tabela inteira.
set -euo pipefail
dir="${1:-supabase}"
falhas=0
tabelas=$(grep -hoiE 'create table (if not exists )?[a-z_."]+' "$dir"/*.sql \
  | awk '{print $NF}' | tr -d '"' | sed 's/^public\.//' | sort -u)
for t in $tabelas; do
  if ! grep -qiE "alter table (public\.)?\"?$t\"? enable row level security" "$dir"/*.sql; then
    echo "::error::Tabela '$t' sem RLS habilitado"; falhas=$((falhas+1)); continue
  fi
  if ! grep -qiE "create policy [^;]* on (public\.)?\"?$t\"?" "$dir"/*.sql; then
    echo "::error::Tabela '$t' com RLS mas sem nenhuma policy"; falhas=$((falhas+1)); continue
  fi
  echo "OK  $t — RLS habilitado e com policy"
done
# Toda função SECURITY DEFINER precisa fixar search_path (na mesma linha ou na seguinte)
while IFS= read -r achado; do
  arq=${achado%%:*}; resto=${achado#*:}; linha=${resto%%:*}
  if ! sed -n "${linha},$((linha+1))p" "$arq" | grep -qi 'search_path'; then
    echo "::error::$arq:$linha — SECURITY DEFINER sem SET search_path"; falhas=$((falhas+1))
  fi
done < <(grep -niE 'security definer' "$dir"/*.sql || true)
[ "$falhas" -eq 0 ] && echo "Políticas de banco: todas as verificações passaram." || exit 1
