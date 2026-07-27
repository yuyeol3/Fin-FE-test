import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Header from './components/Header'
import Footer from './components/Footer';
import Login from './pages/Login';
import Main from './pages/Main';
import Introduce from './pages/Introduce';
import Agreement from './pages/Agreement';
import AuthGuard from './routes/AuthGuard';
import Recommend from './pages/Recommend';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import ProductRateCalculator from './pages/ProductRateCalculator';
import MyPage from './pages/MyPage';
import ScrollToTop from "./components/ScrollToTop";

function isMockMode() {
  return import.meta.env.DEV
    && new URLSearchParams(window.location.search).get("mock") === "true";
}

function RecommendRoute() {
  if (isMockMode()) return <Recommend />;
  return <AuthGuard><Recommend /></AuthGuard>;
}

function MyPageRoute() {
  if (isMockMode()) return <MyPage />;
  return <AuthGuard><MyPage /></AuthGuard>;
}

// POST /calculator는 인증이 필요하다.
function CalculatorRoute() {
  if (isMockMode()) return <ProductRateCalculator />;
  return <AuthGuard><ProductRateCalculator /></AuthGuard>;
}

// 백엔드 OAuth2 실패 시 app.oauth2.failure-redirect-url(/login-error)로 302된다.
function LoginError() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#EFFFFD] font-inter">
      <p className="text-[22px] font-semibold text-[#03BFA5]">로그인에 실패했어요</p>
      <p className="text-[15px] text-[#606060]">잠시 후 다시 시도해 주세요.</p>
      <Link to="/login" className="rounded-lg border border-[#03BFA5] bg-white px-5 py-2 text-[15px] text-[#03BFA5] hover:bg-[#F7FFFE]">
        로그인으로 돌아가기
      </Link>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/login-error" element={<LoginError />} />
        <Route path="/introduce" element={<Introduce />} />
        <Route path="/recommend" element={<RecommendRoute />} />
        <Route path="/products" element={<ProductList/>}/>
        <Route path="/products/:productId" element={<ProductDetail />} />
        <Route path="/products/:productId/calculator" element={<CalculatorRoute />} />
        <Route path="/mypage" element={<MyPageRoute />} />
        
        <Route
          path="/"
          element={
            <AuthGuard>
              <Main />
            </AuthGuard>
          }
        />
        
        <Route path="/terms" element={
          <div className="min-h-screen bg-[#EFFFFD]">
            <Agreement />
          </div>
        } />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
