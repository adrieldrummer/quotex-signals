"""
Quotex Screenshotter — sessao Patchright sempre viva, tira print real da plataforma.

Uso:
    sshot = QuotexScreenshotter(email, password)
    await sshot.start()             # abre browser + loga + troca pra DEMO
    png = await sshot.snap('AUDJPY_otc')  # screenshot da operacao no par X
    await sshot.stop()
"""
import os
import asyncio
import logging
from typing import Optional
from patchright.async_api import async_playwright, Page, BrowserContext

log = logging.getLogger("screenshotter")

QX_URL = "https://qxbroker.com/pt/sign-in"
TRADE_URL = "https://qxbroker.com/pt/trade"


class QuotexScreenshotter:
    def __init__(self, email: str, password: str, account_mode: str = "DEMO"):
        self.email = email
        self.password = password
        self.account_mode = account_mode  # DEMO ou REAL
        self._pw = None
        self._ctx: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._ready = False

    async def start(self, retries: int = 2):
        self._pw = await async_playwright().__aenter__()
        user_data_dir = os.path.join(os.path.expanduser("~"), ".quotex_pw_profile")
        os.makedirs(user_data_dir, exist_ok=True)

        # persistent_context mantem cookies — depois do 1o login nao precisa logar
        self._ctx = await self._pw.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            channel="chrome",
            headless=False,
            no_viewport=False,
            viewport={"width": 1366, "height": 768},
            args=["--disable-blink-features=AutomationControlled", "--start-maximized"],
        )
        self._page = self._ctx.pages[0] if self._ctx.pages else await self._ctx.new_page()

        for attempt in range(retries + 1):
            try:
                await self._page.goto(TRADE_URL, wait_until="domcontentloaded", timeout=45000)
                await asyncio.sleep(4)
                # se redirecionou pra signin, loga
                if "sign-in" in self._page.url or "login" in self._page.url:
                    await self._do_login()
                # garante conta DEMO
                await self._ensure_demo_account()
                self._ready = True
                log.info("Screenshotter pronto.")
                return True
            except Exception as e:
                log.warning(f"start attempt {attempt} falhou: {e}")
                await asyncio.sleep(3)
        return False

    async def _do_login(self):
        log.info("Fazendo login web...")
        try:
            await self._page.wait_for_selector('input[name="email"]:visible', timeout=20000)
            await self._page.fill('input[name="email"]:visible', self.email)
            await self._page.fill('input[name="password"]:visible', self.password)
            await self._page.click('button:has-text("Entrar"), button[type="submit"]', timeout=5000)
            await self._page.wait_for_url("**/trade*", timeout=30000)
            await asyncio.sleep(3)
        except Exception as e:
            log.error(f"login falhou: {e}")
            raise

    async def _ensure_demo_account(self):
        """Tenta trocar pra DEMO clicando no seletor de conta no header."""
        try:
            # tenta encontrar o botao do tipo de conta (VIVER ou DEMO ou Real)
            # Quotex usa um dropdown clicavel no topo direito
            account_btn = self._page.locator('header').locator('button:has-text("R$"), button:has-text("$"), .top-bar__account-tab, .account-tab').first
            await account_btn.click(timeout=5000)
            await asyncio.sleep(1)
            # Clica em DEMO
            demo_opt = self._page.locator('text=/DEMO|Treinamento|Practice/i').first
            await demo_opt.click(timeout=5000)
            await asyncio.sleep(2)
            log.info("Trocado pra conta DEMO.")
        except Exception as e:
            log.warning(f"ensure_demo falhou (talvez ja estava em demo): {e}")

    async def _switch_asset(self, asset: str) -> bool:
        """Tenta abrir o asset X no chart (necessário pra screenshot fazer sentido)."""
        try:
            # clica no nome do asset atual no topo
            asset_label = self._page.locator('.asset-select, button:has-text("(OTC)"), [class*="asset"]').first
            await asset_label.click(timeout=5000)
            await asyncio.sleep(1)
            # busca por simbolo
            base = asset.replace("_otc", "").replace("OTC", "").strip("/")
            await self._page.fill('input[placeholder*="Buscar" i], input[type="search"]', base)
            await asyncio.sleep(1)
            # clica primeiro resultado OTC
            otc_first = self._page.locator(f'text=/{base[:3]}.{base[3:]}.*OTC/i').first
            await otc_first.click(timeout=5000)
            await asyncio.sleep(2)
            return True
        except Exception as e:
            log.debug(f"switch_asset {asset} falhou: {e}")
            return False

    async def snap(self, asset: str = None, full_page: bool = False) -> Optional[bytes]:
        if not self._ready:
            return None
        try:
            if asset:
                await self._switch_asset(asset)
            await asyncio.sleep(1)
            return await self._page.screenshot(full_page=full_page, type="png")
        except Exception as e:
            log.error(f"snap falhou: {e}")
            return None

    async def stop(self):
        try:
            if self._ctx: await self._ctx.close()
            if self._pw: await self._pw.__aexit__(None, None, None)
        except Exception:
            pass


# ============================================================
# Teste standalone
# ============================================================
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    async def test():
        sshot = QuotexScreenshotter(os.getenv("QUOTEX_EMAIL"), os.getenv("QUOTEX_PASSWORD"))
        ok = await sshot.start()
        print(f"start ok={ok}")
        png = await sshot.snap(full_page=False)
        if png:
            with open("snap_test.png", "wb") as f:
                f.write(png)
            print(f"screenshot salvo: snap_test.png ({len(png)} bytes)")
        await sshot.stop()

    asyncio.run(test())
