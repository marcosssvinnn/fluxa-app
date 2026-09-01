#!/usr/bin/env python3
"""Desliga o Autofill do Android pro WebView inteiro do app nativo.

Por que isso existe: o formulário de login (nome + senha de 4 dígitos)
casa exatamente com a heurística que o Android usa pra oferecer/preencher
credenciais salvas — "campo de texto seguido de campo type=password" — e
isso vale DENTRO de um WebView de app nativo (Capacitor), não só no
Chrome. O front-end já pede pra não fazer isso (`autocomplete="one-time-
code"`, `data-lpignore`, etc. em index.html), mas esses são só PEDIDOS —
alguns serviços de autofill de fabricante (Samsung Pass, por ex.) ignoram
esses atributos. `setImportantForAutofill(IMPORTANT_FOR_AUTOFILL_NO)` é a
única forma que o próprio Android garante: manda o framework de Autofill
inteiro pular essa View, sem depender de nenhum serviço respeitar nada.

Investigação real (28/08): time reportando "digito a senha certa e dá
errada", só em alguns aparelhos, sobrevivendo a desinstalar e reinstalar o
app — corrigido o campo (ver index.html) e reforçado aqui a nível de SO,
já que não dá pra confirmar de fora qual serviço de autofill cada aparelho
usa.

Rodado pelo workflow build-android-apk.yml, com cwd = android/, logo após
`npx cap add android` (mesma etapa que já roda patch-android-debug-signing.py).
"""
import json
import re
import sys

CAPACITOR_CONFIG = "../capacitor.config.json"


def main():
    with open(CAPACITOR_CONFIG) as f:
        app_id = json.load(f)["appId"]

    pkg_path = app_id.replace(".", "/")
    java_file = f"app/src/main/java/{pkg_path}/MainActivity.java"

    with open(java_file) as f:
        content = f.read()

    pattern = re.compile(
        r"public class MainActivity extends BridgeActivity \{\s*\}"
    )
    if not pattern.search(content):
        sys.exit(
            f"Corpo vazio esperado de MainActivity não encontrado em {java_file} "
            "— o template do Capacitor mudou, revisar este script"
        )

    content = content.replace(
        "import com.getcapacitor.BridgeActivity;",
        "import android.os.Bundle;\n"
        "import android.view.View;\n"
        "import com.getcapacitor.BridgeActivity;",
        1,
    )

    new_body = (
        "public class MainActivity extends BridgeActivity {\n"
        "    @Override\n"
        "    public void onCreate(Bundle savedInstanceState) {\n"
        "        super.onCreate(savedInstanceState);\n"
        "        // Desliga o Autofill do Android pra este WebView inteiro — ver\n"
        "        // comentário no topo deste script pra motivo/investigação.\n"
        "        if (getBridge() != null && getBridge().getWebView() != null) {\n"
        "            getBridge().getWebView().setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);\n"
        "        }\n"
        "    }\n"
        "}"
    )
    content = pattern.sub(new_body, content)

    with open(java_file, "w") as f:
        f.write(content)

    print(f"Autofill desligado via setImportantForAutofill em {java_file}")


if __name__ == "__main__":
    main()
