from .cdkeyshare import CdkeyShareAdapter
from .gamario import GamarioAdapter
from .gamecenter import GameCenterAdapter
from .gameonestore import GameoneStoreAdapter
from .gameplayshop import GameplayShopAdapter
from .nakhlmarket import NakhlMarketAdapter
from .parsconsole import ParsConsoleAdapter
from .persianconsole import PersianConsoleAdapter
from .pspro import PsProAdapter
from .technolife import TechnoLifeAdapter
from .xgamesstore import XgamesStoreAdapter
from .yungcenter import YungCenterAdapter

ADAPTERS = {
    PsProAdapter.seller: PsProAdapter,
    YungCenterAdapter.seller: YungCenterAdapter,
    NakhlMarketAdapter.seller: NakhlMarketAdapter,
    TechnoLifeAdapter.seller: TechnoLifeAdapter,
    PersianConsoleAdapter.seller: PersianConsoleAdapter,
    GameplayShopAdapter.seller: GameplayShopAdapter,
    GameCenterAdapter.seller: GameCenterAdapter,
    GamarioAdapter.seller: GamarioAdapter,
    GameoneStoreAdapter.seller: GameoneStoreAdapter,
    XgamesStoreAdapter.seller: XgamesStoreAdapter,
    ParsConsoleAdapter.seller: ParsConsoleAdapter,
    CdkeyShareAdapter.seller: CdkeyShareAdapter,
}
