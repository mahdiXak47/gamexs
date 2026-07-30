from .cdkeyshare import CdkeyShareAdapter
from .clockstore1 import ClockStore1Adapter
from .digikala import DigikalaAdapter
from .dragonshop import DragonShopAdapter
from .doctorgame import DoctorGameAdapter
from .hajigame import HajiGameAdapter
from .gameaccess import GameAccessAdapter
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
    DigikalaAdapter.seller: DigikalaAdapter,
    DragonShopAdapter.seller: DragonShopAdapter,
    DoctorGameAdapter.seller: DoctorGameAdapter,
    HajiGameAdapter.seller: HajiGameAdapter,
    GameAccessAdapter.seller: GameAccessAdapter,
    ClockStore1Adapter.seller: ClockStore1Adapter,
}
